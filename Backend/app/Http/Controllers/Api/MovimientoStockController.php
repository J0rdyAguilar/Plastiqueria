<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\MovimientoStockStoreRequest;
use App\Models\MovimientoStock;
use App\Services\StockService;
use Illuminate\Http\Request;

class MovimientoStockController extends Controller
{
    public function __construct(private StockService $stockService) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $role = strtolower((string) ($user->role ?? $user->rol ?? ''));
        $userUbicacionId = (int) ($user->ubicacion_id ?? $user->sucursal_id ?? 0);

        $tipoRaw = trim((string) $request->query('tipo', ''));
        $ubicacionId = $request->query('ubicacion_id');
        $productoId = $request->query('producto_id');

        $tipo = null;

        if ($tipoRaw !== '' && strtolower($tipoRaw) !== 'todos') {
            $map = [
                'entrada'  => 'entrada',
                'salida'   => 'salida',
                'traslado' => 'traslado',
                'ajuste'   => 'ajuste',
                'in'       => 'entrada',
                'out'      => 'salida',
                'transfer' => 'traslado',
                'adjust'   => 'ajuste',
            ];

            $tipoLower = strtolower($tipoRaw);

            if (!array_key_exists($tipoLower, $map)) {
                return response()->json([
                    'message' => 'Tipo inválido. Usa entrada, salida, traslado o ajuste.',
                    'errors' => [
                        'tipo' => ['Tipo inválido. Usa entrada, salida, traslado o ajuste.'],
                    ],
                ], 422);
            }

            $tipo = $map[$tipoLower];
        }

        $query = MovimientoStock::query()
            ->with([
                'producto:id,sku,nombre',
                'productoPrecio:id,producto_id,presentacion,factor_base,precio_costo,precio_venta',
                'ubicacionOrigen:id,nombre,tipo',
                'ubicacionDestino:id,nombre,tipo',
            ])
            ->orderByDesc('creado_en');

        if ($tipo) {
            $query->where('tipo', $tipo);
        }

        if ($productoId !== null && $productoId !== '') {
            $query->where('producto_id', (int) $productoId);
        }

        if ($role === 'superadmin') {
            if ($ubicacionId !== null && $ubicacionId !== '') {
                $uid = (int) $ubicacionId;

                $query->where(function ($w) use ($uid) {
                    $w->where('ubicacion_origen_id', $uid)
                      ->orWhere('ubicacion_destino_id', $uid);
                });
            }
        } else {
            if (!$userUbicacionId) {
                return response()->json([
                    'message' => 'El usuario no tiene una sucursal asignada.'
                ], 403);
            }

            $query->where(function ($w) use ($userUbicacionId) {
                $w->where('ubicacion_origen_id', $userUbicacionId)
                  ->orWhere('ubicacion_destino_id', $userUbicacionId);
            });
        }

        return response()->json(
            $query->paginate((int) $request->query('per_page', 10))
                ->through(function ($m) {
                    return [
                        'id' => $m->id,
                        'tipo' => $m->tipo,
                        'producto_id' => $m->producto_id,
                        'producto_precio_id' => $m->producto_precio_id,
                        'producto_nombre' => $m->producto?->nombre,
                        'producto_sku' => $m->producto?->sku,
                        'presentacion' => $m->presentacion ?: $m->productoPrecio?->presentacion,
                        'factor_aplicado' => $m->factor_aplicado,

                        // Compatibilidad si el frontend aún usa "precio"
                        'precio' => $m->productoPrecio?->precio_venta,
                        'precio_costo' => $m->productoPrecio?->precio_costo,
                        'precio_venta' => $m->productoPrecio?->precio_venta,

                        'cantidad' => $m->cantidad,
                        'cantidad_base' => $m->cantidad_base,
                        'ubicacion_origen_id' => $m->ubicacion_origen_id,
                        'ubicacion_destino_id' => $m->ubicacion_destino_id,
                        'ubicacion_origen_nombre' => $m->ubicacionOrigen?->nombre,
                        'ubicacion_destino_nombre' => $m->ubicacionDestino?->nombre,
                        'motivo' => $m->motivo,
                        'creado_en' => optional($m->creado_en)->format('Y-m-d H:i:s'),
                    ];
                })
        );
    }

    public function store(MovimientoStockStoreRequest $request)
    {
        $user = $request->user();
        $role = strtolower((string) ($user->role ?? $user->rol ?? ''));
        $userUbicacionId = (int) ($user->ubicacion_id ?? $user->sucursal_id ?? 0);

        if ($role !== 'superadmin' && !$userUbicacionId) {
            return response()->json([
                'message' => 'El usuario no tiene una sucursal asignada.',
                'errors' => [
                    'ubicacion' => ['El usuario no tiene una sucursal asignada.'],
                ],
            ], 422);
        }

        $data = $request->validated();
        $tipo = strtolower((string) ($data['tipo'] ?? ''));
        $origen = isset($data['ubicacion_origen_id']) ? (int) $data['ubicacion_origen_id'] : null;
        $destino = isset($data['ubicacion_destino_id']) ? (int) $data['ubicacion_destino_id'] : null;

        if ($role !== 'superadmin') {
            if ($tipo === 'entrada') {
                $data['ubicacion_destino_id'] = $userUbicacionId;
                unset($data['ubicacion_origen_id']);
            } elseif ($tipo === 'salida' || $tipo === 'ajuste') {
                $data['ubicacion_origen_id'] = $userUbicacionId;
                unset($data['ubicacion_destino_id']);
            } elseif ($tipo === 'traslado') {
                $data['ubicacion_origen_id'] = $userUbicacionId;

                if (empty($destino)) {
                    return response()->json([
                        'message' => 'Debes seleccionar una ubicación destino.',
                        'errors' => [
                            'ubicacion_destino_id' => ['Debes seleccionar una ubicación destino.'],
                        ],
                    ], 422);
                }

                if ((int) $destino === $userUbicacionId) {
                    return response()->json([
                        'message' => 'La ubicación destino no puede ser la misma que la sucursal del usuario.',
                        'errors' => [
                            'ubicacion_destino_id' => ['La ubicación destino no puede ser la misma que la sucursal del usuario.'],
                        ],
                    ], 422);
                }
            }
        } else {
            if ($tipo === 'traslado' && $origen && $destino && $origen === $destino) {
                return response()->json([
                    'message' => 'La ubicación origen y destino no pueden ser la misma.',
                    'errors' => [
                        'ubicacion_destino_id' => ['La ubicación origen y destino no pueden ser la misma.'],
                    ],
                ], 422);
            }
        }

        $userId = (int) ($user?->id ?? auth()->id() ?? 0);

        $mov = $this->stockService->apply($data, $userId);

        return response()->json([
            'message' => 'Movimiento aplicado correctamente.',
            'data' => $mov,
        ], 201);
    }
}