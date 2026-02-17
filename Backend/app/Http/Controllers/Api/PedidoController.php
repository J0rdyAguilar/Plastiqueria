<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PedidoStoreRequest;
use App\Models\Pedido;
use App\Models\PedidoDetalle;
use App\Models\Producto;
use App\Models\ProductoUnidad;
use App\Services\StockService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PedidoController extends Controller
{
    public function __construct(private StockService $stockService) {}

    // GET /api/pedidos?estado=&vendedor_id=&cliente_id=
    public function index(Request $request)
    {
        $estado = $request->query('estado');
        $vendedorId = $request->query('vendedor_id');
        $clienteId = $request->query('cliente_id');

        $q = Pedido::query()
            ->with(['cliente', 'vendedor', 'detalles.producto.imagenPrincipal'])
            ->orderByDesc('creado_en');

        if ($estado) $q->where('estado', $estado);
        if ($vendedorId) $q->where('vendedor_id', (int)$vendedorId);
        if ($clienteId) $q->where('cliente_id', (int)$clienteId);

        return response()->json($q->paginate((int)$request->query('per_page', 10)));
    }

    // POST /api/pedidos  (vendedor crea borrador)
    public function store(PedidoStoreRequest $request)
    {
        $userId = (int)($request->user()?->id ?? auth()->id() ?? 0);

        $data = $request->validated();

        return DB::transaction(function () use ($data, $userId) {

            $pedido = Pedido::create([
                'codigo' => $data['codigo'] ?? $this->generarCodigo(),
                'cliente_id' => (int)$data['cliente_id'],
                'vendedor_id' => $userId,
                'estado' => 'borrador',
                'fecha_pedido' => $data['fecha_pedido'] ?? now()->toDateString(),
                'notas' => $data['notas'] ?? null,
                'canal' => $data['canal'] ?? 'ruta',
            ]);

            foreach ($data['detalles'] as $d) {
                $productoId = (int)$d['producto_id'];
                $unidad = (string)$d['unidad'];            // enum
                $cantidad = (int)$d['cantidad'];

                $cantidadBase = $this->calcularCantidadBase($productoId, $unidad, $cantidad, $d['cantidad_base'] ?? null);

                PedidoDetalle::create([
                    'pedido_id' => $pedido->id,
                    'producto_id' => $productoId,
                    'unidad' => $unidad,
                    'cantidad' => $cantidad,
                    'cantidad_base' => $cantidadBase,

                    // precios se llenan cuando admin aprueba
                    'precio_variable' => 0,
                    'precio_sugerido_1' => null,
                    'precio_sugerido_2' => null,
                    'precio_sugerido_3' => null,
                    'precio_unitario' => null,
                    'total_linea' => null,
                ]);
            }

            $pedido->load(['cliente', 'vendedor', 'detalles.producto.imagenPrincipal']);

            return response()->json($pedido, 201);
        });
    }

    // POST /api/pedidos/{pedido}/enviar  (vendedor envía al admin)
    public function enviar(Pedido $pedido, Request $request)
    {
        // (luego: validar que solo el vendedor dueño pueda enviar)
        if ($pedido->estado !== 'borrador') {
            return response()->json(['message' => 'Solo se puede enviar un pedido en borrador.'], 422);
        }

        $pedido->estado = 'enviado_admin';
        $pedido->actualizado_en = now();
        $pedido->save();

        return response()->json(['message' => 'Pedido enviado al admin.', 'data' => $pedido]);
    }

    // POST /api/pedidos/{pedido}/aprobar (admin aprueba y pone precios)
    public function aprobar(Pedido $pedido, Request $request)
    {
        if (!in_array($pedido->estado, ['enviado_admin','borrador'], true)) {
            return response()->json(['message' => 'El pedido no está en estado válido para aprobar.'], 422);
        }

        $data = $request->validate([
            'detalles' => 'required|array|min:1',
            'detalles.*.id' => 'required|integer|exists:pedido_detalles,id',
            'detalles.*.precio_variable' => 'required|boolean',
            'detalles.*.precio_sugerido_1' => 'nullable|numeric|min:0',
            'detalles.*.precio_sugerido_2' => 'nullable|numeric|min:0',
            'detalles.*.precio_sugerido_3' => 'nullable|numeric|min:0',
            'detalles.*.precio_unitario' => 'required|numeric|min:0',
        ]);

        return DB::transaction(function () use ($pedido, $data) {

            $totalPedido = 0;

            foreach ($data['detalles'] as $d) {
                $det = PedidoDetalle::where('pedido_id', $pedido->id)->where('id', (int)$d['id'])->firstOrFail();

                $precio = (float)$d['precio_unitario'];
                $totalLinea = $precio * (int)$det->cantidad_base;

                $det->precio_variable = (bool)$d['precio_variable'];
                $det->precio_sugerido_1 = $d['precio_sugerido_1'] ?? null;
                $det->precio_sugerido_2 = $d['precio_sugerido_2'] ?? null;
                $det->precio_sugerido_3 = $d['precio_sugerido_3'] ?? null;
                $det->precio_unitario = $precio;
                $det->total_linea = $totalLinea;
                $det->save();

                $totalPedido += $totalLinea;
            }

            $pedido->estado = 'aprobado';
            $pedido->actualizado_en = now();
            $pedido->save();

            $pedido->load(['cliente','vendedor','detalles.producto.imagenPrincipal']);

            return response()->json([
                'message' => 'Pedido aprobado.',
                'total' => $totalPedido,
                'data' => $pedido
            ]);
        });
    }

    // POST /api/pedidos/{pedido}/preparar (admin prepara y descuenta stock)
    public function preparar(Pedido $pedido, Request $request)
    {
        if ($pedido->estado !== 'aprobado') {
            return response()->json(['message' => 'Solo se puede preparar un pedido aprobado.'], 422);
        }

        $data = $request->validate([
            'ubicacion_origen_id' => 'required|integer|exists:ubicaciones,id', // de dónde sale (bodega/tienda)
        ]);

        $userId = (int)($request->user()?->id ?? auth()->id() ?? 0);
        $ubicacionOrigenId = (int)$data['ubicacion_origen_id'];

        return DB::transaction(function () use ($pedido, $userId, $ubicacionOrigenId) {

            // por cada línea, creamos una "salida" que descuente stock
            foreach ($pedido->detalles()->get() as $det) {
                $this->stockService->apply([
                    'tipo' => 'salida', // enum real
                    'ubicacion_origen_id' => $ubicacionOrigenId,
                    'producto_id' => (int)$det->producto_id,
                    'cantidad_base' => (int)$det->cantidad_base,
                    'motivo' => "Salida por pedido {$pedido->codigo}",
                    'referencia_tipo' => 'pedido',
                    'referencia_id' => (int)$pedido->id,
                ], $userId);
            }

            $pedido->estado = 'preparado';
            $pedido->actualizado_en = now();
            $pedido->save();

            return response()->json(['message' => 'Pedido preparado y stock descontado.', 'data' => $pedido]);
        });
    }

    // POST /api/pedidos/{pedido}/entregar (vendedor marca entregado)
    public function entregar(Pedido $pedido, Request $request)
    {
        if (!in_array($pedido->estado, ['preparado','en_ruta'], true)) {
            return response()->json(['message' => 'Solo se puede entregar un pedido preparado o en ruta.'], 422);
        }

        $data = $request->validate([
            'fecha_entrega' => 'nullable|date',
        ]);

        $pedido->estado = 'entregado';
        $pedido->fecha_entrega = $data['fecha_entrega'] ?? now()->toDateString();
        $pedido->entregado_en = now();
        $pedido->actualizado_en = now();
        $pedido->save();

        return response()->json(['message' => 'Pedido entregado.', 'data' => $pedido]);
    }

    // =========================
    // Helpers
    // =========================

    private function generarCodigo(): string
    {
        return 'PED-' . now()->format('Ymd-His') . '-' . random_int(100, 999);
    }

    private function calcularCantidadBase(int $productoId, string $unidad, int $cantidad, ?int $cantidadBaseRequest): int
    {
        // Si el frontend ya manda cantidad_base, la respetamos
        if ($cantidadBaseRequest !== null) {
            return (int)$cantidadBaseRequest;
        }

        // Intentamos buscar factor en producto_unidades (si existe la unidad ahí)
        $pu = ProductoUnidad::query()
            ->where('producto_id', $productoId)
            ->where('nombre', $unidad) // ajusta si tu columna se llama distinto
            ->first();

        $factor = $pu?->factor ?? 1; // ajusta si tu columna se llama distinto
        return $cantidad * (int)$factor;
    }
}
