<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Stock;
use Illuminate\Http\Request;

class StockController extends Controller
{
    private function roleOf($user): string
    {
        $role = strtolower((string) ($user->role ?? $user->rol ?? ''));
        $role = str_replace(['-', ' '], '_', $role);

        if ($role === 'superadmin') {
            return 'super_admin';
        }

        if ($role === 'administrador_de_bodega' || $role === 'adminbod') {
            return 'admin_bodega';
        }

        if ($role === 'vendedor_tienda') {
            return 'vendedor-tienda';
        }

        return $role;
    }

    private function userUbicacionId($user): ?int
    {
        $id = $user->ubicacion_id ?? $user->sucursal_id ?? null;
        return $id !== null ? (int) $id : null;
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);

        $q = trim((string) $request->query('q', ''));
        $ubicacionId = $request->query('ubicacion_id');
        $perPage = max(1, min(200, (int) $request->query('per_page', 20)));

        $query = Stock::query()->with([
            'producto:id,sku,nombre',
            'productoPrecio:id,producto_id,presentacion,factor_base,precio_costo,precio_venta,activo',
            'ubicacion:id,nombre,tipo',
        ]);

        if ($role === 'super_admin') {
            if (!empty($ubicacionId)) {
                $query->where('ubicacion_id', (int) $ubicacionId);
            }
        } else {
            $userUbicacionId = $this->userUbicacionId($user);

            if (!$userUbicacionId) {
                return response()->json([
                    'message' => 'El usuario no tiene una sucursal asignada.'
                ], 403);
            }

            $query->where('ubicacion_id', $userUbicacionId);
        }

        if ($q !== '') {
            $query->where(function ($w) use ($q) {
                $w->whereHas('producto', function ($sub) use ($q) {
                    $sub->where('nombre', 'like', "%{$q}%")
                        ->orWhere('sku', 'like', "%{$q}%")
                        ->orWhere('id', 'like', "%{$q}%");
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
                $cantidad = (float) ($s->cantidad ?? 0);
                $cantidadBase = (float) ($s->cantidad_base ?? 0);

                return [
                    'id' => (int) $s->id,
                    'ubicacion_id' => (int) $s->ubicacion_id,
                    'ubicacion_nombre' => $s->ubicacion?->nombre,

                    'producto_id' => (string) $s->producto_id,
                    'producto_precio_id' => (int) $s->producto_precio_id,
                    'producto_nombre' => $s->producto?->nombre,
                    'producto_sku' => $s->producto?->sku,

                    'presentacion' => $s->productoPrecio?->presentacion,
                    'factor_base' => (float) ($s->productoPrecio?->factor_base ?? 1),

                    'precio' => (float) ($s->productoPrecio?->precio_venta ?? 0),
                    'precio_costo' => (float) ($s->productoPrecio?->precio_costo ?? 0),
                    'precio_venta' => (float) ($s->productoPrecio?->precio_venta ?? 0),

                    'cantidad' => $cantidad,
                    'cantidad_base' => $cantidadBase,

                    'estado' => $cantidad <= 0
                        ? 'agotado'
                        : ($cantidad <= 5 ? 'bajo' : 'disponible'),

                    'actualizado_en' => optional($s->actualizado_en)?->format('Y-m-d H:i:s'),
                ];
            });
    }
}