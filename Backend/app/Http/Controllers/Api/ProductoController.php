<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductoResource;
use App\Models\Producto;
use App\Models\ProductoPrecio;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProductoController extends Controller
{
    public function index(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $perPage = (int) $request->query('per_page', 10);
        $activo = $request->query('activo');

        $query = Producto::with([
            'imagenPrincipal:id,producto_id,url,es_principal,orden',
            'precios:id,producto_id,presentacion,factor_base,precio_costo,precio_venta,activo,creado_en,actualizado_en',
        ]);

        if ($q !== '') {
            $query->where(function ($sub) use ($q) {
                $sub->where('sku', 'like', "%{$q}%")
                    ->orWhere('nombre', 'like', "%{$q}%")
                    ->orWhere('descripcion', 'like', "%{$q}%");

                if (is_numeric($q)) {
                    $sub->orWhere('id', (int) $q);
                }
            });
        }

        if ($activo !== null && $activo !== '') {
            $query->where('activo', (int) $activo);
        }

        return ProductoResource::collection(
            $query->orderBy('nombre')->paginate($perPage)
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'sku' => 'nullable|string|max:50|unique:productos,sku',
            'nombre' => 'required|string|max:150',
            'descripcion' => 'nullable|string',
            'unidad_base' => 'required|string|max:50',
            'activo' => 'boolean',

            'precios' => 'required|array|min:1',
            'precios.*.presentacion' => [
                'required',
                'string',
                'max:50',
                Rule::in(['unidad', 'docena', 'paquete', 'caja', 'bolsa', 'fardo', 'millar', 'cubo']),
            ],
            'precios.*.factor_base' => 'required|numeric|min:0.0001',
            'precios.*.precio_costo' => 'required|numeric|min:0',
            'precios.*.precio_venta' => 'required|numeric|min:0',
            'precios.*.activo' => 'nullable|boolean',
        ]);

        return DB::transaction(function () use ($data) {
            $ahora = now();

            $producto = Producto::create([
                'sku' => $data['sku'] ?? null,
                'nombre' => $data['nombre'],
                'descripcion' => $data['descripcion'] ?? null,
                'unidad_base' => $data['unidad_base'],
                'activo' => $data['activo'] ?? true,
                'creado_en' => $ahora,
                'actualizado_en' => $ahora,
            ]);

            foreach ($data['precios'] as $item) {
                ProductoPrecio::create([
                    'producto_id' => $producto->id,
                    'presentacion' => $item['presentacion'],
                    'factor_base' => $item['factor_base'],
                    'precio_costo' => $item['precio_costo'],
                    'precio_venta' => $item['precio_venta'],
                    'activo' => $item['activo'] ?? true,
                    'creado_en' => $ahora,
                    'actualizado_en' => $ahora,
                ]);
            }

            $producto->load([
                'imagenPrincipal:id,producto_id,url,es_principal,orden',
                'precios:id,producto_id,presentacion,factor_base,precio_costo,precio_venta,activo,creado_en,actualizado_en',
            ]);

            return response()->json([
                'message' => 'Producto creado correctamente.',
                'data' => new ProductoResource($producto),
            ], 201);
        });
    }

    public function show(Producto $producto)
    {
        $producto->load([
            'precios:id,producto_id,presentacion,factor_base,precio_costo,precio_venta,activo,creado_en,actualizado_en',
            'imagenes',
            'imagenPrincipal',
        ]);

        return response()->json([
            'data' => new ProductoResource($producto),
        ]);
    }

    public function update(Request $request, Producto $producto)
    {
        $data = $request->validate([
            'sku' => 'nullable|string|max:50|unique:productos,sku,' . $producto->id,
            'nombre' => 'required|string|max:150',
            'descripcion' => 'nullable|string',
            'unidad_base' => 'required|string|max:50',
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
            'precios.*.precio_costo' => 'required|numeric|min:0',
            'precios.*.precio_venta' => 'required|numeric|min:0',
            'precios.*.activo' => 'nullable|boolean',
        ]);

        return DB::transaction(function () use ($producto, $data) {
            $ahora = now();

            $producto->update([
                'sku' => $data['sku'] ?? null,
                'nombre' => $data['nombre'],
                'descripcion' => $data['descripcion'] ?? null,
                'unidad_base' => $data['unidad_base'],
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
                    fn ($q) => $q
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
                            'precio_costo' => $item['precio_costo'],
                            'precio_venta' => $item['precio_venta'],
                            'activo' => $item['activo'] ?? true,
                            'actualizado_en' => $ahora,
                        ]);
                    } else {
                        ProductoPrecio::create([
                            'producto_id' => $producto->id,
                            'presentacion' => $item['presentacion'],
                            'factor_base' => $item['factor_base'],
                            'precio_costo' => $item['precio_costo'],
                            'precio_venta' => $item['precio_venta'],
                            'activo' => $item['activo'] ?? true,
                            'creado_en' => $ahora,
                            'actualizado_en' => $ahora,
                        ]);
                    }
                } else {
                    ProductoPrecio::create([
                        'producto_id' => $producto->id,
                        'presentacion' => $item['presentacion'],
                        'factor_base' => $item['factor_base'],
                        'precio_costo' => $item['precio_costo'],
                        'precio_venta' => $item['precio_venta'],
                        'activo' => $item['activo'] ?? true,
                        'creado_en' => $ahora,
                        'actualizado_en' => $ahora,
                    ]);
                }
            }

            $producto->load([
                'imagenPrincipal:id,producto_id,url,es_principal,orden',
                'precios:id,producto_id,presentacion,factor_base,precio_costo,precio_venta,activo,creado_en,actualizado_en',
            ]);

            return response()->json([
                'message' => 'Producto actualizado correctamente.',
                'data' => new ProductoResource($producto),
            ]);
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
        $productos = Producto::where('activo', true)
            ->with([
                'precios' => function ($q) {
                    $q->where('activo', true)
                        ->orderBy('presentacion');
                },
                'imagenes' => fn ($q) => $q->orderBy('orden'),
                'imagenPrincipal:id,producto_id,url,es_principal,orden',
            ])
            ->orderBy('nombre')
            ->get();

        return response()->json([
            'data' => ProductoResource::collection($productos),
        ]);
    }
}