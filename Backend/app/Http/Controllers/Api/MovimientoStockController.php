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
            ->orderByDesc('creado_en');

        if ($tipo) $query->where('tipo', $tipo);

        if ($productoId) $query->where('producto_id', (int)$productoId);

        if ($ubicacionId) {
            $uid = (int)$ubicacionId;
            $query->where(function ($w) use ($uid) {
                $w->where('ubicacion_origen_id', $uid)
                  ->orWhere('ubicacion_destino_id', $uid);
            });
        }

        return response()->json(
            $query->paginate((int)$request->query('per_page', 10))
        );
    }

    // POST /api/movimientos-stock
    public function store(MovimientoStockStoreRequest $request)
    {
        $userId = (int)($request->user()?->id ?? auth()->id() ?? 0);

        $mov = $this->stockService->apply($request->validated(), $userId);

        return response()->json([
            'message' => 'Movimiento aplicado correctamente.',
            'data' => $mov,
        ], 201);
    }
}
