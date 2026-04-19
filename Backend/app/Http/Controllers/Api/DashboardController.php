<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Caja;
use App\Models\MovimientoCaja;
use App\Models\Pedido;
use App\Models\PedidoDetalle;
use App\Models\Producto;
use App\Models\VentaTienda;
use App\Models\VentaTiendaDetalle;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DashboardController extends Controller
{
    private function roleOf($user): string
    {
        $role = strtolower((string) ($user->role ?? $user->rol ?? ''));
        $role = str_replace(['-', ' '], '_', $role);

        if ($role === 'superadmin') {
            return 'super_admin';
        }

        if ($role === 'adminbod' || $role === 'administrador_de_bodega') {
            return 'admin_bodega';
        }

        return $role;
    }

    private function getUbicacionId(Request $request): ?int
    {
        $user = $request->user();
        $role = $this->roleOf($user);

        if ($role === 'super_admin') {
            $id = $request->query('ubicacion_id');
            return ($id !== null && $id !== '') ? (int) $id : null;
        }

        $id = $user->ubicacion_id ?? $user->sucursal_id ?? null;
        return $id !== null ? (int) $id : null;
    }

    private function firstExistingColumn(array $columns, array $candidates): ?string
    {
        foreach ($candidates as $candidate) {
            if (in_array($candidate, $columns, true)) {
                return $candidate;
            }
        }

        return null;
    }

    public function resumen(Request $request)
    {
        try {
            $ubicacionId = $this->getUbicacionId($request);
            $role = $this->roleOf($request->user());

            $hoyInicio = Carbon::today()->startOfDay();
            $hoyFin = Carbon::today()->endOfDay();

            $mesInicio = Carbon::now()->startOfMonth()->startOfDay();
            $mesFin = Carbon::now()->endOfMonth()->endOfDay();

            $ingresosHoy = $this->sumIngresos($hoyInicio, $hoyFin, $ubicacionId);
            $ingresosMes = $this->sumIngresos($mesInicio, $mesFin, $ubicacionId);

            $topProductos = $this->topProductosVendidos($ubicacionId, 5);
            $productoMasVendido = $topProductos->first();

            $ingresosPorSucursal = collect();
            if ($role === 'super_admin') {
                $ingresosPorSucursal = $this->ingresosPorSucursal($mesInicio, $mesFin);
            }

            return response()->json([
                'ok' => true,
                'data' => [
                    'cards' => [
                        'ingresos_hoy' => (float) $ingresosHoy,
                        'ingresos_mes' => (float) $ingresosMes,
                        'producto_mas_vendido' => $productoMasVendido,
                    ],
                    'top_productos' => $topProductos,
                    'ingresos_por_sucursal' => $ingresosPorSucursal,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'ok' => false,
                'message' => 'No se pudo cargar el dashboard.',
                'error' => $e->getMessage(),
                'line' => $e->getLine(),
                'file' => $e->getFile(),
            ], 500);
        }
    }

    private function sumIngresos(Carbon $inicio, Carbon $fin, ?int $ubicacionId = null): float
    {
        $movCajaTable = (new MovimientoCaja())->getTable();
        $cajaTable = (new Caja())->getTable();

        if (!Schema::hasTable($movCajaTable) || !Schema::hasTable($cajaTable)) {
            return 0;
        }

        $movCols = Schema::getColumnListing($movCajaTable);
        $cajaCols = Schema::getColumnListing($cajaTable);

        $tipoCol = $this->firstExistingColumn($movCols, ['tipo', 'naturaleza', 'movimiento']);
        $montoCol = $this->firstExistingColumn($movCols, ['monto', 'total', 'importe', 'cantidad']);
        $fechaCol = $this->firstExistingColumn($movCols, ['created_at', 'creado_en', 'fecha', 'fecha_movimiento']);
        $cajaIdCol = $this->firstExistingColumn($movCols, ['caja_id']);
        $ubicacionCol = $this->firstExistingColumn($cajaCols, ['ubicacion_id', 'sucursal_id']);

        if (!$tipoCol || !$montoCol || !$fechaCol || !$cajaIdCol) {
            return 0;
        }

        $tiposIngreso = ['ingreso', 'entrada', 'abono', 'cobro', 'venta'];

        $query = DB::table($movCajaTable)
            ->join($cajaTable, $cajaTable . '.id', '=', $movCajaTable . '.' . $cajaIdCol)
            ->whereBetween($movCajaTable . '.' . $fechaCol, [$inicio, $fin])
            ->where(function ($q) use ($movCajaTable, $tipoCol, $tiposIngreso) {
                foreach ($tiposIngreso as $i => $tipo) {
                    if ($i === 0) {
                        $q->where($movCajaTable . '.' . $tipoCol, $tipo);
                    } else {
                        $q->orWhere($movCajaTable . '.' . $tipoCol, $tipo);
                    }
                }
            });

        if ($ubicacionId && $ubicacionCol) {
            $query->where($cajaTable . '.' . $ubicacionCol, $ubicacionId);
        }

        return (float) $query->sum($movCajaTable . '.' . $montoCol);
    }

    private function ingresosPorSucursal(Carbon $inicio, Carbon $fin)
    {
        $movCajaTable = (new MovimientoCaja())->getTable();
        $cajaTable = (new Caja())->getTable();

        if (!Schema::hasTable($movCajaTable) || !Schema::hasTable($cajaTable) || !Schema::hasTable('ubicaciones')) {
            return collect();
        }

        $movCols = Schema::getColumnListing($movCajaTable);
        $cajaCols = Schema::getColumnListing($cajaTable);

        $tipoCol = $this->firstExistingColumn($movCols, ['tipo', 'naturaleza', 'movimiento']);
        $montoCol = $this->firstExistingColumn($movCols, ['monto', 'total', 'importe', 'cantidad']);
        $fechaCol = $this->firstExistingColumn($movCols, ['created_at', 'creado_en', 'fecha', 'fecha_movimiento']);
        $cajaIdCol = $this->firstExistingColumn($movCols, ['caja_id']);
        $ubicacionCol = $this->firstExistingColumn($cajaCols, ['ubicacion_id', 'sucursal_id']);

        if (!$tipoCol || !$montoCol || !$fechaCol || !$cajaIdCol || !$ubicacionCol) {
            return collect();
        }

        $tiposIngreso = ['ingreso', 'entrada', 'abono', 'cobro', 'venta'];

        return DB::table($movCajaTable)
            ->join($cajaTable, $cajaTable . '.id', '=', $movCajaTable . '.' . $cajaIdCol)
            ->join('ubicaciones', 'ubicaciones.id', '=', $cajaTable . '.' . $ubicacionCol)
            ->whereBetween($movCajaTable . '.' . $fechaCol, [$inicio, $fin])
            ->where(function ($q) use ($movCajaTable, $tipoCol, $tiposIngreso) {
                foreach ($tiposIngreso as $i => $tipo) {
                    if ($i === 0) {
                        $q->where($movCajaTable . '.' . $tipoCol, $tipo);
                    } else {
                        $q->orWhere($movCajaTable . '.' . $tipoCol, $tipo);
                    }
                }
            })
            ->groupBy($cajaTable . '.' . $ubicacionCol, 'ubicaciones.nombre')
            ->select(
                DB::raw($cajaTable . '.' . $ubicacionCol . ' as ubicacion_id'),
                'ubicaciones.nombre',
                DB::raw('SUM(' . $movCajaTable . '.' . $montoCol . ') as total_ingresos')
            )
            ->orderByDesc('total_ingresos')
            ->get();
    }

    private function topProductosVendidos(?int $ubicacionId = null, int $limit = 5)
    {
        $pedidoTable = (new Pedido())->getTable();
        $pedidoDetalleTable = (new PedidoDetalle())->getTable();
        $ventaTable = (new VentaTienda())->getTable();
        $ventaDetalleTable = (new VentaTiendaDetalle())->getTable();
        $productoTable = (new Producto())->getTable();

        $subqueries = [];

        if (Schema::hasTable($ventaTable) && Schema::hasTable($ventaDetalleTable)) {
            $ventaCols = Schema::getColumnListing($ventaTable);
            $ventaDetalleCols = Schema::getColumnListing($ventaDetalleTable);

            $ventaIdCol = $this->firstExistingColumn($ventaDetalleCols, ['venta_id']);
            $ventaProductoIdCol = $this->firstExistingColumn($ventaDetalleCols, ['producto_id']);
            $ventaCantidadCol = $this->firstExistingColumn($ventaDetalleCols, ['cantidad']);
            $ventaUbicacionCol = $this->firstExistingColumn($ventaCols, ['ubicacion_id', 'sucursal_id']);

            if ($ventaIdCol && $ventaProductoIdCol && $ventaCantidadCol) {
                $qVentas = DB::table($ventaDetalleTable . ' as vd')
                    ->join($ventaTable . ' as v', 'v.id', '=', 'vd.' . $ventaIdCol)
                    ->select(
                        'vd.' . $ventaProductoIdCol . ' as producto_id',
                        DB::raw('SUM(vd.' . $ventaCantidadCol . ') as total_vendido')
                    )
                    ->groupBy('vd.' . $ventaProductoIdCol);

                if ($ubicacionId && $ventaUbicacionCol) {
                    $qVentas->where('v.' . $ventaUbicacionCol, $ubicacionId);
                }

                $subqueries[] = $qVentas;
            }
        }

        if (Schema::hasTable($pedidoTable) && Schema::hasTable($pedidoDetalleTable)) {
            $pedidoCols = Schema::getColumnListing($pedidoTable);
            $pedidoDetalleCols = Schema::getColumnListing($pedidoDetalleTable);

            $pedidoIdCol = $this->firstExistingColumn($pedidoDetalleCols, ['pedido_id']);
            $pedidoProductoIdCol = $this->firstExistingColumn($pedidoDetalleCols, ['producto_id']);
            $pedidoCantidadCol = $this->firstExistingColumn($pedidoDetalleCols, ['cantidad']);
            $pedidoEstadoCol = $this->firstExistingColumn($pedidoCols, ['estado']);
            $pedidoUbicacionCol = $this->firstExistingColumn($pedidoCols, ['ubicacion_id', 'sucursal_id']);

            if ($pedidoIdCol && $pedidoProductoIdCol && $pedidoCantidadCol) {
                $qPedidos = DB::table($pedidoDetalleTable . ' as pd')
                    ->join($pedidoTable . ' as p', 'p.id', '=', 'pd.' . $pedidoIdCol)
                    ->select(
                        'pd.' . $pedidoProductoIdCol . ' as producto_id',
                        DB::raw('SUM(pd.' . $pedidoCantidadCol . ') as total_vendido')
                    )
                    ->groupBy('pd.' . $pedidoProductoIdCol);

                if ($pedidoEstadoCol) {
                    $qPedidos->whereIn('p.' . $pedidoEstadoCol, [
                        'aprobado',
                        'preparando',
                        'en_ruta',
                        'entregado',
                    ]);
                }

                if ($ubicacionId && $pedidoUbicacionCol) {
                    $qPedidos->where('p.' . $pedidoUbicacionCol, $ubicacionId);
                }

                $subqueries[] = $qPedidos;
            }
        }

        if (empty($subqueries) || !Schema::hasTable($productoTable)) {
            return collect();
        }

        $union = array_shift($subqueries);

        foreach ($subqueries as $subquery) {
            $union->unionAll($subquery);
        }

        return DB::query()
            ->fromSub($union, 'movs')
            ->join($productoTable . ' as pr', 'pr.id', '=', 'movs.producto_id')
            ->select(
                'movs.producto_id',
                'pr.nombre',
                'pr.sku',
                DB::raw('SUM(movs.total_vendido) as total_vendido')
            )
            ->groupBy('movs.producto_id', 'pr.nombre', 'pr.sku')
            ->orderByDesc('total_vendido')
            ->limit($limit)
            ->get();
    }
}