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
            ->when($productoId, fn($qq) => $qq->where('producto_id', $productoId))
            ->orderByDesc('activo')
            ->orderBy('unidad');

        return $q->paginate(20);
    }

    public function store(StoreProductoPrecioRequest $request)
    {
    $data = $request->validated();
    

     $row   = ProductoPrecio::create($data);


        return DB::transaction(function () use ($data) {

            // Evitar duplicados: mismo producto + misma unidad
            $exists = ProductoPrecio::where('producto_id', $data['producto_id'])
                ->where('unidad', $data['unidad'])
                ->exists();

            if ($exists) {
                return response()->json([
                    'message' => 'Ya existe un registro de precios para este producto y esa unidad.'
                ], 422);
            }

            $row = ProductoPrecio::create($data);
            return response()->json($row, 201);
        });
    }

    public function show(ProductoPrecio $productoPrecio)
    {
        return $productoPrecio;
    }

    public function update(UpdateProductoPrecioRequest $request, ProductoPrecio $productoPrecio)
    {
        $data = $request->validated();

        return DB::transaction(function () use ($data, $productoPrecio) {

            // Si cambian la unidad, validar que no choque con otro registro del mismo producto
            if (isset($data['unidad']) && $data['unidad'] !== $productoPrecio->unidad) {
                $exists = ProductoPrecio::where('producto_id', $productoPrecio->producto_id)
                    ->where('unidad', $data['unidad'])
                    ->where('id', '!=', $productoPrecio->id)
                    ->exists();

                if ($exists) {
                    return response()->json([
                        'message' => 'Ya existe otro registro de precios para este producto con esa unidad.'
                    ], 422);
                }
            }

            $productoPrecio->update($data);
            return response()->json($productoPrecio);
        });
    }

    public function destroy(ProductoPrecio $productoPrecio)
    {
        $productoPrecio->delete();
        return response()->json(['message' => 'Precios eliminados']);
    }
}
