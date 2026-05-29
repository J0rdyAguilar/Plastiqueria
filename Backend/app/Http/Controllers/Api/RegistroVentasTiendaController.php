<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Venta;
use App\Models\Ubicacion;
use Illuminate\Http\Request;

class RegistroVentasTiendaController extends Controller
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
            return 'vendedor_tienda';
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
        $userUbicacionId = $this->userUbicacionId($user);

        $fechaDesde = $request->query('fecha_desde');
        $fechaHasta = $request->query('fecha_hasta');
        $metodoPago = trim((string) $request->query('metodo_pago', ''));
        $ubicacionId = $request->query('ubicacion_id');
        $soloMias = (int) $request->query('solo_mias', 0);
        $perPage = (int) $request->query('per_page', 30);
        $perPage = max(1, min($perPage, 100));

        /*
        |--------------------------------------------------------------------------
        | SUCURSALES DISPONIBLES
        |--------------------------------------------------------------------------
        | Super admin: debe ver TODAS las sucursales activas
        | Otros roles: solo su sucursal
        */
        if ($role === 'super_admin') {
            $sucursales = Ubicacion::query()
                ->select('id', 'nombre')
                ->where('activo', 1)
                ->orderBy('nombre')
                ->get();
        } else {
            $sucursales = Ubicacion::query()
                ->select('id', 'nombre')
                ->where('activo', 1)
                ->when($userUbicacionId, fn ($q) => $q->where('id', $userUbicacionId))
                ->orderBy('nombre')
                ->get();
        }

        $query = Venta::query()
            ->with([
                'usuario:id,nombre,usuario',
                'ubicacion:id,nombre',
                'cliente:id,nombre',
                'detalles.producto:id,nombre',
            ])
            ->where(function ($q) {
                $q->whereNull('tipo')
                  ->orWhere('tipo', 'tienda');
            });

        if ($fechaDesde) {
            $query->whereDate('created_at', '>=', $fechaDesde);
        }

        if ($fechaHasta) {
            $query->whereDate('created_at', '<=', $fechaHasta);
        }

        if ($metodoPago !== '') {
            $query->where('metodo_pago', $metodoPago);
        }

        /*
        |--------------------------------------------------------------------------
        | FILTRO DE SUCURSAL
        |--------------------------------------------------------------------------
        */
        if ($role === 'super_admin') {
            if (!empty($ubicacionId)) {
                $query->where('ubicacion_id', (int) $ubicacionId);
            }
        } else {
            if ($userUbicacionId) {
                $query->where('ubicacion_id', $userUbicacionId);
            }
        }

        /*
        |--------------------------------------------------------------------------
        | SOLO MÍAS
        |--------------------------------------------------------------------------
        */
        if ($soloMias === 1) {
            $query->where('usuario_id', $user->id);
        }

        $ventas = $query
            ->latest('id')
            ->paginate($perPage);

        $data = collect($ventas->items())->map(function ($venta) {
            return [
                'id' => $venta->id,
                'total' => (float) ($venta->total ?? 0),
                'ganancia_total' => (float) ($venta->ganancia_total ?? 0),
                'estado' => $venta->estado,
                'metodo_pago' => $venta->metodo_pago,
                'creado_en' => optional($venta->created_at)?->toDateTimeString(),

                'usuario_nombre' => $venta->usuario->nombre ?? $venta->usuario->usuario ?? null,
                'ubicacion_nombre' => $venta->ubicacion->nombre ?? null,
                'nombre_comprador' => $venta->cliente->nombre ?? null,

                'usuario' => $venta->usuario ? [
                    'id' => $venta->usuario->id,
                    'nombre' => $venta->usuario->nombre,
                    'usuario' => $venta->usuario->usuario,
                ] : null,

                'ubicacion' => $venta->ubicacion ? [
                    'id' => $venta->ubicacion->id,
                    'nombre' => $venta->ubicacion->nombre,
                ] : null,

                'cliente' => $venta->cliente ? [
                    'id' => $venta->cliente->id,
                    'nombre' => $venta->cliente->nombre,
                ] : null,

                'detalles' => collect($venta->detalles ?? [])->map(function ($d) {
                    return [
                        'producto_id' => $d->producto_id,
                        'producto_nombre' => $d->producto->nombre ?? null,
                        'presentacion' => $d->presentacion,
                        'cantidad' => (float) ($d->cantidad ?? 0),
                        'precio_costo' => (float) ($d->precio_costo ?? 0),
                        'precio_unitario' => (float) ($d->precio_unitario ?? 0),
                        'subtotal' => (float) ($d->subtotal ?? 0),
                        'ganancia_unitaria' => (float) ($d->ganancia_unitaria ?? 0),
                        'ganancia_total' => (float) ($d->ganancia_total ?? 0),
                    ];
                })->values(),
            ];
        })->values();

        return response()->json([
            'data' => $data,
            'sucursales' => $sucursales->values(),
            'meta' => [
                'current_page' => $ventas->currentPage(),
                'last_page' => $ventas->lastPage(),
                'per_page' => $ventas->perPage(),
                'total' => $ventas->total(),
            ],
        ]);
    }
}