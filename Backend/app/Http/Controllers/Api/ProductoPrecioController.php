<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreProductoPrecioRequest;
use App\Http\Requests\UpdateProductoPrecioRequest;
use App\Models\ProductoPrecio;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductoPrecioController extends Controller
{
    public function index(Request $request)
    {
        $productoId = $request->query('producto_id');

        $q = ProductoPrecio::query()
            ->when($productoId, fn ($qq) => $qq->where('producto_id', $productoId))
            ->orderByDesc('activo')
            ->orderBy('presentacion');

        return $q->paginate(20);
    }

    public function store(StoreProductoPrecioRequest $request)
    {
        $data = $request->validated();

        return DB::transaction(function () use ($data) {
            $exists = ProductoPrecio::where('producto_id', $data['producto_id'])
                ->where('presentacion', $data['presentacion'])
                ->exists();

            if ($exists) {
                return response()->json([
                    'message' => 'Ya existe un registro de precios para este producto y esa presentación.'
                ], 422);
            }

            $row = ProductoPrecio::create([
                'producto_id'   => $data['producto_id'],
                'presentacion'  => $data['presentacion'],
                'factor_base'   => $data['factor_base'],
                'precio_costo'  => $data['precio_costo'],
                'precio_venta'  => $data['precio_venta'],
                'activo'        => $data['activo'] ?? true,
            ]);

            return response()->json($row, 201);
        });
    }

    public function show(ProductoPrecio $productoPrecio)
    {
        return response()->json($productoPrecio);
    }

    public function update(UpdateProductoPrecioRequest $request, ProductoPrecio $productoPrecio)
    {
        $data = $request->validated();

        return DB::transaction(function () use ($data, $productoPrecio) {
            $nuevaPresentacion = $data['presentacion'] ?? $productoPrecio->presentacion;

            $exists = ProductoPrecio::where('producto_id', $productoPrecio->producto_id)
                ->where('presentacion', $nuevaPresentacion)
                ->where('id', '!=', $productoPrecio->id)
                ->exists();

            if ($exists) {
                return response()->json([
                    'message' => 'Ya existe otro registro de precios para este producto con esa presentación.'
                ], 422);
            }

            $productoPrecio->update([
                'presentacion' => $data['presentacion'] ?? $productoPrecio->presentacion,
                'factor_base'  => $data['factor_base'] ?? $productoPrecio->factor_base,
                'precio_costo' => $data['precio_costo'] ?? $productoPrecio->precio_costo,
                'precio_venta' => $data['precio_venta'] ?? $productoPrecio->precio_venta,
                'activo'       => $data['activo'] ?? $productoPrecio->activo,
            ]);

            return response()->json($productoPrecio->fresh());
        });
    }

    public function destroy(ProductoPrecio $productoPrecio)
    {
        $productoPrecio->delete();

        return response()->json([
            'message' => 'Precio eliminado correctamente'
        ]);
    }
}