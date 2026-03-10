<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Producto;
use App\Models\Stock;
use App\Models\Ubicacion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductoController extends Controller
{

public function index(Request $request)
{
    $q = trim((string) $request->query('q', ''));
    $perPage = (int) $request->query('per_page', 10);

    $query = Producto::with([
        'imagenPrincipal:id,producto_id,url,es_principal,orden'
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
            ];
        });
}

    public function store(Request $request)
    {
        $data = $request->validate([
            'sku'           => 'nullable|string|max:50|unique:productos,sku',
            'nombre'        => 'required|string|max:150',
            'descripcion'   => 'nullable|string',
            'unidad_base'   => 'required',
            'alerta_stock'  => 'nullable|integer|min:0',
            'activo'        => 'boolean',
        ]);

        return DB::transaction(function () use ($data) {

            // 1) Crear producto (tu modelo NO usa timestamps normales)
            $producto = Producto::create([
                'sku'          => $data['sku'] ?? null,
                'nombre'       => $data['nombre'],
                'descripcion'  => $data['descripcion'] ?? null,
                'unidad_base'  => $data['unidad_base'],
                'alerta_stock' => $data['alerta_stock'] ?? 0,
                'activo'       => $data['activo'] ?? true,
                'creado_en'    => now(),
            ]);

            // 2) Crear stock en 0 para TODAS las ubicaciones
            $ubicaciones = Ubicacion::query()->pluck('id');

            foreach ($ubicaciones as $ubicacionId) {
                Stock::query()->firstOrCreate(
                    [
                        'producto_id'  => $producto->id,
                        'ubicacion_id' => $ubicacionId,
                    ],
                    [
                        'cantidad_base' => 0,
                    ]
                );
            }

            // 3) devolver con imagenPrincipal cargada (aunque aún esté null)
            $producto->load(['imagenPrincipal']);

            return response()->json($producto, 201);
        });
    }

    public function show(Producto $producto)
    {
        // ✅ también incluye imagenPrincipal aparte
        return $producto->load(['unidades', 'precios', 'imagenes', 'imagenPrincipal']);
    }

    public function update(Request $request, Producto $producto)
    {
        $data = $request->validate([
            'sku'           => 'nullable|string|max:50|unique:productos,sku,' . $producto->id,
            'nombre'        => 'required|string|max:150',
            'descripcion'   => 'nullable|string',
            'unidad_base'   => 'required',
            'alerta_stock'  => 'nullable|integer|min:0',
            'activo'        => 'boolean',
        ]);

        $data['actualizado_en'] = now();

        $producto->update($data);

        $producto->load(['imagenPrincipal']);

        return response()->json($producto);
    }

    public function destroy(Producto $producto)
    {
        $producto->delete();
        return response()->json(['message' => 'Producto eliminado']);
    }

    /**
     * Catálogo para pedidos
     */
    public function catalogo()
    {
        return Producto::where('activo', true)
            ->with([
                'unidades',
                'precios',
                'imagenes' => fn ($q) => $q->orderBy('orden'),
                'imagenPrincipal:id,producto_id,url,es_principal,orden'
            ])
            ->orderBy('nombre')
            ->get()
            ->map(function ($p) {
                $p->imagen_principal = $p->imagenPrincipal ? [
                    'id' => $p->imagenPrincipal->id,
                    'url' => $p->imagenPrincipal->url,
                ] : null;
                return $p;
            });
    }
}
