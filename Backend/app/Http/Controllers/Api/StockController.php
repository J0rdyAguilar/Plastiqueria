<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Stock;
use Illuminate\Http\Request;

class StockController extends Controller
{
    // GET /api/stock?ubicacion_id=&q=&page=&per_page=
    public function index(Request $request)
    {
        $ubicacionId = $request->query('ubicacion_id');
        $q = trim((string)$request->query('q', ''));

        $query = Stock::query()
            ->join('productos', 'productos.id', '=', 'stock.producto_id')
            ->select([
                'stock.id',
                'stock.ubicacion_id',
                'stock.producto_id',
                'stock.cantidad_base',
                'stock.actualizado_en',
                'productos.nombre as producto_nombre',
            ]);

        if ($ubicacionId) {
            $query->where('stock.ubicacion_id', (int)$ubicacionId);
        }

        if ($q !== '') {
            $query->where('productos.nombre', 'like', "%{$q}%");
        }

        $items = $query
            ->orderBy('productos.nombre')
            ->paginate((int)$request->query('per_page', 10));

        return response()->json($items);
    }
}
