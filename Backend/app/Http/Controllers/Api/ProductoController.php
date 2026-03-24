<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Producto;
use App\Models\ProductoPrecio;
use App\Models\Stock;
use App\Models\Ubicacion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProductoController extends Controller
{
    public function index(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $perPage = (int) $request->query('per_page', 10);

        $query = Producto::with([
            'imagenPrincipal:id,producto_id,url,es_principal,orden',
            'precios:id,producto_id,presentacion,factor_base,precio,activo,creado_en,actualizado_en',
        ]);

        if ($q !== '') {
            $query->where(function ($sub) use ($q) {
                $sub->where('sku', 'like', "%{$q}%")
                    ->orWhere('nombre', 'like', "%{$q}%");

                if (is_numeric($q)) {
                    $sub->orWhere('id', (int) $q);
                }
            });
        }

        return $query
            ->orderBy('nombre')
            ->paginate($perPage)
            ->through(function ($p) {
                return [
                    'id' => $p->id,
                    'sku' => $p->sku,
                    'nombre' => $p->nombre,
                    'descripcion' => $p->descripcion,
                    'unidad_base' => $p->unidad_base,
                    'alerta_stock' => $p->alerta_stock,
                    'activo' => (bool) $p->activo,
                    'imagen_principal' => $p->imagenPrincipal ? [
                        'id' => $p->imagenPrincipal->id,
                        'url' => $p->imagenPrincipal->url,
                    ] : null,
                    'precios' => $p->precios->map(function ($precio) {
                        return [
                            'id' => $precio->id,
                            'presentacion' => $precio->presentacion,
                            'factor_base' => (float) $precio->factor_base,
                            'precio' => (float) $precio->precio,
                            'activo' => (bool) $precio->activo,
                        ];
                    })->values(),
                ];
            });
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'sku' => 'nullable|string|max:50|unique:productos,sku',
            'nombre' => 'required|string|max:150',
            'descripcion' => 'nullable|string',
            'unidad_base' => 'required|string|max:50',
            'alerta_stock' => 'nullable|integer|min:0',
            'activo' => 'boolean',

            'precios' => 'required|array|min:1',
            'precios.*.presentacion' => [
                'required',
                'string',
                'max:50',
                Rule::in(['unidad', 'docena', 'paquete', 'caja', 'bolsa', 'fardo', 'millar', 'cubo']),
            ],
            'precios.*.factor_base' => 'required|numeric|min:0.0001',
            'precios.*.precio' => 'required|numeric|min:0',
            'precios.*.activo' => 'nullable|boolean',
        ]);

        return DB::transaction(function () use ($data) {
            $ahora = now();

            $producto = Producto::create([
                'sku' => $data['sku'] ?? null,
                'nombre' => $data['nombre'],
                'descripcion' => $data['descripcion'] ?? null,
                'unidad_base' => $data['unidad_base'],
                'alerta_stock' => $data['alerta_stock'] ?? 0,
                'activo' => $data['activo'] ?? true,
                'creado_en' => $ahora,
            ]);

            foreach ($data['precios'] as $item) {
                ProductoPrecio::create([
                    'producto_id' => $producto->id,
                    'presentacion' => $item['presentacion'],
                    'factor_base' => $item['factor_base'],
                    'precio' => $item['precio'],
                    'activo' => $item['activo'] ?? true,
                    'creado_en' => $ahora,
                ]);
            }

            $ubicaciones = Ubicacion::query()->pluck('id');

            foreach ($ubicaciones as $ubicacionId) {
                Stock::query()->firstOrCreate(
                    [
                        'producto_id' => $producto->id,
                        'ubicacion_id' => $ubicacionId,
                    ],
                    [
                        'cantidad_base' => 0,
                    ]
                );
            }

            $producto->load([
                'imagenPrincipal:id,producto_id,url,es_principal,orden',
                'precios:id,producto_id,presentacion,factor_base,precio,activo,creado_en,actualizado_en',
            ]);

            return response()->json($producto, 201);
        });
    }

    public function show(Producto $producto)
    {
        return $producto->load([
            'unidades',
            'precios',
            'imagenes',
            'imagenPrincipal',
        ]);
    }

    public function update(Request $request, Producto $producto)
    {
        $data = $request->validate([
            'sku' => 'nullable|string|max:50|unique:productos,sku,' . $producto->id,
            'nombre' => 'required|string|max:150',
            'descripcion' => 'nullable|string',
            'unidad_base' => 'required|string|max:50',
            'alerta_stock' => 'nullable|integer|min:0',
            'activo' => 'boolean',

            'precios' => 'required|array|min:1',
            'precios.*.id' => 'nullable|integer',
            'precios.*.presentacion' => [
                'required',
                'string',
                'max:50',
                Rule::in(['unidad', 'docena', 'paquete', 'caja', 'bolsa', 'fardo', 'millar', 'cubo']),
            ],
            'precios.*.factor_base' => 'required|numeric|min:0.0001',
            'precios.*.precio' => 'required|numeric|min:0',
            'precios.*.activo' => 'nullable|boolean',
        ]);

        return DB::transaction(function () use ($producto, $data) {
            $ahora = now();

            $producto->update([
                'sku' => $data['sku'] ?? null,
                'nombre' => $data['nombre'],
                'descripcion' => $data['descripcion'] ?? null,
                'unidad_base' => $data['unidad_base'],
                'alerta_stock' => $data['alerta_stock'] ?? 0,
                'activo' => $data['activo'] ?? true,
                'actualizado_en' => $ahora,
            ]);

            $idsRecibidos = collect($data['precios'])
                ->pluck('id')
                ->filter()
                ->values()
                ->all();

            ProductoPrecio::query()
                ->where('producto_id', $producto->id)
                ->when(
                    count($idsRecibidos) > 0,
                    fn ($q) => $q->whereNotIn('id', $idsRecibidos),
                    fn ($q) => $q->whereRaw('1 = 1')
                )
                ->delete();

            foreach ($data['precios'] as $item) {
                if (!empty($item['id'])) {
                    $precio = ProductoPrecio::query()
                        ->where('producto_id', $producto->id)
                        ->where('id', $item['id'])
                        ->first();

                    if ($precio) {
                        $precio->update([
                            'presentacion' => $item['presentacion'],
                            'factor_base' => $item['factor_base'],
                            'precio' => $item['precio'],
                            'activo' => $item['activo'] ?? true,
                            'actualizado_en' => $ahora,
                        ]);
                    } else {
                        ProductoPrecio::create([
                            'producto_id' => $producto->id,
                            'presentacion' => $item['presentacion'],
                            'factor_base' => $item['factor_base'],
                            'precio' => $item['precio'],
                            'activo' => $item['activo'] ?? true,
                            'creado_en' => $ahora,
                        ]);
                    }
                } else {
                    ProductoPrecio::create([
                        'producto_id' => $producto->id,
                        'presentacion' => $item['presentacion'],
                        'factor_base' => $item['factor_base'],
                        'precio' => $item['precio'],
                        'activo' => $item['activo'] ?? true,
                        'creado_en' => $ahora,
                    ]);
                }
            }

            $producto->load([
                'imagenPrincipal:id,producto_id,url,es_principal,orden',
                'precios:id,producto_id,presentacion,factor_base,precio,activo,creado_en,actualizado_en',
            ]);

            return response()->json($producto);
        });
    }

    public function destroy(Producto $producto)
    {
        $producto->delete();

        return response()->json([
            'message' => 'Producto eliminado',
        ]);
    }

    public function catalogo()
    {
        return Producto::where('activo', true)
            ->with([
                'unidades',
                'precios' => function ($q) {
                    $q->where('activo', true)
                        ->orderBy('presentacion');
                },
                'imagenes' => fn ($q) => $q->orderBy('orden'),
                'imagenPrincipal:id,producto_id,url,es_principal,orden',
            ])
            ->orderBy('nombre')
            ->get()
            ->map(function ($p) {
                return [
                    'id' => $p->id,
                    'sku' => $p->sku,
                    'nombre' => $p->nombre,
                    'descripcion' => $p->descripcion,
                    'unidad_base' => $p->unidad_base,
                    'alerta_stock' => $p->alerta_stock,
                    'activo' => (bool) $p->activo,
                    'imagen_principal' => $p->imagenPrincipal ? [
                        'id' => $p->imagenPrincipal->id,
                        'url' => $p->imagenPrincipal->url,
                    ] : null,
                    'precios' => $p->precios->map(function ($precio) {
                        return [
                            'id' => $precio->id,
                            'presentacion' => $precio->presentacion,
                            'factor_base' => (float) $precio->factor_base,
                            'precio' => (float) $precio->precio,
                            'activo' => (bool) $precio->activo,
                        ];
                    })->values(),
                ];
            });
    }
}