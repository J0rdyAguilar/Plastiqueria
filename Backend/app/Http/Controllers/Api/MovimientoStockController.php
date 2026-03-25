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
                'productoPrecio:id,producto_id,presentacion,factor_base,precio',
            ])
            ->orderByDesc('creado_en');

        if ($tipo) {
            $query->where('tipo', $tipo);
        }

        if ($productoId !== null && $productoId !== '') {
            $query->where('producto_id', (int) $productoId);
        }

        if ($ubicacionId !== null && $ubicacionId !== '') {
            $uid = (int) $ubicacionId;

            $query->where(function ($w) use ($uid) {
                $w->where('ubicacion_origen_id', $uid)
                  ->orWhere('ubicacion_destino_id', $uid);
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
                        'cantidad' => $m->cantidad,
                        'cantidad_base' => $m->cantidad_base,
                        'ubicacion_origen_id' => $m->ubicacion_origen_id,
                        'ubicacion_destino_id' => $m->ubicacion_destino_id,
                        'motivo' => $m->motivo,
                        'creado_en' => optional($m->creado_en)->format('Y-m-d H:i:s'),
                    ];
                })
        );
    }

    public function store(MovimientoStockStoreRequest $request)
    {
        $userId = (int) ($request->user()?->id ?? auth()->id() ?? 0);

        $mov = $this->stockService->apply($request->validated(), $userId);

        return response()->json([
            'message' => 'Movimiento aplicado correctamente.',
            'data' => $mov,
        ], 201);
    }
}