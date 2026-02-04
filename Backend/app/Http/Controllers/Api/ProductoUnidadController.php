<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreProductoUnidadRequest;
use App\Http\Requests\UpdateProductoUnidadRequest;
use App\Models\ProductoUnidad;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductoUnidadController extends Controller
{
    /**
     * Listar unidades por producto (opcional ?producto_id=)
     */
    public function index(Request $request)
    {
        $productoId = $request->query('producto_id');

        $q = ProductoUnidad::query()
            ->when($productoId, fn($qq) => $qq->where('producto_id', $productoId))
            ->orderByDesc('es_predeterminada')
            ->orderBy('factor_base');

        return $q->paginate(20);
    }

    /**
     * Crear unidad
     */
    public function store(StoreProductoUnidadRequest $request)
    {
        $data = $request->validated();
        $data['etiqueta'] = $data['etiqueta'] ?? null;
        $data['es_predeterminada'] = (bool)($data['es_predeterminada'] ?? false);

        return DB::transaction(function () use ($data) {

            // Si esta nueva será predeterminada, apagar las demás del producto
            if ($data['es_predeterminada']) {
                ProductoUnidad::where('producto_id', $data['producto_id'])
                    ->update(['es_predeterminada' => 0]);
            }

            $row = ProductoUnidad::create($data);

            return response()->json($row, 201);
        });
    }

    public function show(ProductoUnidad $productoUnidad)
    {
        return $productoUnidad;
    }

    public function update(UpdateProductoUnidadRequest $request, ProductoUnidad $productoUnidad)
    {
        $data = $request->validated();

        return DB::transaction(function () use ($data, $productoUnidad) {

            if (array_key_exists('es_predeterminada', $data) && (bool)$data['es_predeterminada'] === true) {
                ProductoUnidad::where('producto_id', $productoUnidad->producto_id)
                    ->where('id', '!=', $productoUnidad->id)
                    ->update(['es_predeterminada' => 0]);
            }

            $productoUnidad->update($data);

            return response()->json($productoUnidad);
        });
    }

    public function destroy(ProductoUnidad $productoUnidad)
    {
        $productoUnidad->delete();
        return response()->json(['message' => 'Unidad eliminada']);
    }
}
