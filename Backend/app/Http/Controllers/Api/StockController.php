<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Stock;
use Illuminate\Http\Request;

class StockController extends Controller
{
    public function index(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $ubicacionId = $request->query('ubicacion_id');
        $perPage = (int) $request->query('per_page', 20);

        $query = Stock::query()->with([
            'producto:id,sku,nombre',
            'productoPrecio:id,producto_id,presentacion,factor_base,precio,activo',
            'ubicacion:id,nombre,tipo',
        ]);

        if ($ubicacionId) {
            $query->where('ubicacion_id', $ubicacionId);
        }

        if ($q !== '') {
            $query->where(function ($w) use ($q) {
                $w->whereHas('producto', function ($sub) use ($q) {
                    $sub->where('nombre', 'like', "%{$q}%")
                        ->orWhere('sku', 'like', "%{$q}%");

                    if (is_numeric($q)) {
                        $sub->orWhere('id', (int) $q);
                    }
                })->orWhereHas('productoPrecio', function ($sub) use ($q) {
                    $sub->where('presentacion', 'like', "%{$q}%");
                });
            });
        }

        return $query
            ->orderBy('producto_id')
            ->orderBy('producto_precio_id')
            ->paginate($perPage)
            ->through(function ($s) {
                return [
                    'id' => $s->id,
                    'ubicacion_id' => $s->ubicacion_id,
                    'producto_id' => $s->producto_id,
                    'producto_precio_id' => $s->producto_precio_id,
                    'producto_nombre' => $s->producto?->nombre,
                    'producto_sku' => $s->producto?->sku,
                    'presentacion' => $s->productoPrecio?->presentacion,
                    'factor_base' => $s->productoPrecio?->factor_base,
                    'precio' => $s->productoPrecio?->precio,
                    'cantidad' => (int) $s->cantidad,
                    'cantidad_base' => (int) $s->cantidad_base,
                    'actualizado_en' => $s->actualizado_en?->format('Y-m-d H:i:s'),
                ];
            });
    }
}