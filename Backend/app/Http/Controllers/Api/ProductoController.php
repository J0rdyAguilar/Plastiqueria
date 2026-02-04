<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Producto;
use Illuminate\Http\Request;

class ProductoController extends Controller
{
    public function index()
    {
        // ✅ Cargar imagen principal para que el frontend tenga row.imagen_principal.url
        return Producto::with([
                'imagenPrincipal:id,producto_id,url,es_principal,orden'
            ])
            ->orderBy('nombre')
            ->paginate(10)
            ->through(function ($p) {
                return [
                    'id' => $p->id,
                    'sku' => $p->sku,
                    'nombre' => $p->nombre,
                    'descripcion' => $p->descripcion,
                    'unidad_base' => $p->unidad_base,
                    'alerta_stock' => $p->alerta_stock,
                    'activo' => (bool) $p->activo,

                    // 👇 esto es lo que tu JSX espera: row.imagen_principal.url
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

        $producto = Producto::create($data);

        // ✅ devolver con imagenPrincipal cargada (aunque aún esté null)
        $producto->load(['imagenPrincipal']);

        return response()->json($producto, 201);
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
