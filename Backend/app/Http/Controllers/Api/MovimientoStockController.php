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

    // GET /api/movimientos-stock?tipo=&ubicacion_id=&producto_id=&page=
    public function index(Request $request)
    {
        $tipo = $request->query('tipo');
        $ubicacionId = $request->query('ubicacion_id');
        $productoId = $request->query('producto_id');

        $query = MovimientoStock::query()
            ->with([
                'producto:id,sku,nombre,descripcion',
                'ubicacionOrigen:id,nombre,tipo',
                'ubicacionDestino:id,nombre,tipo',
            ])
            ->orderByDesc('creado_en');

        if ($tipo) {
            $query->where('tipo', $tipo);
        }

        if ($productoId) {
            $query->where('producto_id', (int) $productoId);
        }

        if ($ubicacionId) {
            $uid = (int) $ubicacionId;
            $query->where(function ($w) use ($uid) {
                $w->where('ubicacion_origen_id', $uid)
                  ->orWhere('ubicacion_destino_id', $uid);
            });
        }

        $result = $query->paginate((int) $request->query('per_page', 10));

        $result->getCollection()->transform(function ($m) {
            return [
                'id' => $m->id,
                'creado_en' => $m->creado_en,
                'tipo' => $m->tipo,
                'producto_id' => $m->producto_id,
                'producto' => $m->producto ? [
                    'id' => $m->producto->id,
                    'sku' => $m->producto->sku,
                    'nombre' => $m->producto->nombre,
                    'descripcion' => $m->producto->descripcion,
                ] : null,
                'cantidad_base' => $m->cantidad_base,
                'ubicacion_origen_id' => $m->ubicacion_origen_id,
                'ubicacion_origen' => $m->ubicacionOrigen ? [
                    'id' => $m->ubicacionOrigen->id,
                    'nombre' => $m->ubicacionOrigen->nombre,
                    'tipo' => $m->ubicacionOrigen->tipo,
                ] : null,
                'ubicacion_destino_id' => $m->ubicacion_destino_id,
                'ubicacion_destino' => $m->ubicacionDestino ? [
                    'id' => $m->ubicacionDestino->id,
                    'nombre' => $m->ubicacionDestino->nombre,
                    'tipo' => $m->ubicacionDestino->tipo,
                ] : null,
                'motivo' => $m->motivo,
                'referencia_tipo' => $m->referencia_tipo,
                'referencia_id' => $m->referencia_id,
            ];
        });

        return response()->json($result);
    }

    // POST /api/movimientos-stock
    public function store(MovimientoStockStoreRequest $request)
    {
        $userId = (int) ($request->user()?->id ?? auth()->id() ?? 0);

        $mov = $this->stockService->apply($request->validated(), $userId);

        $mov->load([
            'producto:id,sku,nombre,descripcion',
            'ubicacionOrigen:id,nombre,tipo',
            'ubicacionDestino:id,nombre,tipo',
        ]);

        return response()->json([
            'message' => 'Movimiento aplicado correctamente.',
            'data' => [
                'id' => $mov->id,
                'creado_en' => $mov->creado_en,
                'tipo' => $mov->tipo,
                'producto_id' => $mov->producto_id,
                'producto' => $mov->producto ? [
                    'id' => $mov->producto->id,
                    'sku' => $mov->producto->sku,
                    'nombre' => $mov->producto->nombre,
                    'descripcion' => $mov->producto->descripcion,
                ] : null,
                'cantidad_base' => $mov->cantidad_base,
                'ubicacion_origen_id' => $mov->ubicacion_origen_id,
                'ubicacion_origen' => $mov->ubicacionOrigen ? [
                    'id' => $mov->ubicacionOrigen->id,
                    'nombre' => $mov->ubicacionOrigen->nombre,
                    'tipo' => $mov->ubicacionOrigen->tipo,
                ] : null,
                'ubicacion_destino_id' => $mov->ubicacion_destino_id,
                'ubicacion_destino' => $mov->ubicacionDestino ? [
                    'id' => $mov->ubicacionDestino->id,
                    'nombre' => $mov->ubicacionDestino->nombre,
                    'tipo' => $mov->ubicacionDestino->tipo,
                ] : null,
                'motivo' => $mov->motivo,
                'referencia_tipo' => $mov->referencia_tipo,
                'referencia_id' => $mov->referencia_id,
            ],
        ], 201);
    }
}