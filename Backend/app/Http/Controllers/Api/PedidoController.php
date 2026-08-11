<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pedido;
use App\Models\PedidoDetalle;
use App\Models\ProductoPrecio;
use App\Models\Usuario;
use App\Models\Vendedor;
use App\Services\StockService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use App\Models\Caja;
use App\Models\MovimientoCaja;

class PedidoController extends Controller
{
    public function __construct(private StockService $stockService) {}

    private function roleOf($user): string
    {
        $r = strtolower((string) ($user->rol ?? $user->role ?? ''));
        $r = str_replace([' ', '-'], '_', $r);

        if ($r === 'superadmin') return 'super_admin';
        if ($r === 'cajero') return 'caja';
        if ($r === 'adminbod' || $r === 'administrador_de_bodega') return 'admin_bodega';

        return $r;
    }

    private function userUbicacionId($user): ?int
    {
        $id = $user->ubicacion_id ?? $user->sucursal_id ?? null;
        return $id !== null ? (int) $id : null;
    }

    private function resolveVendedorId($user): ?int
    {
        if (!empty($user->vendedor_id)) {
            return (int) $user->vendedor_id;
        }

        $userId = (int) ($user->id ?? 0);
        if ($userId <= 0) return null;

        $vend = Vendedor::query()
            ->where('usuario_id', $userId)
            ->first();

        return $vend ? (int) $vend->id : null;
    }

    private function normalizeEstado(?string $estado): string
    {
        $estado = trim((string) $estado);
        if ($estado === '') return '';

        $estado = mb_strtolower($estado);
        $estado = str_replace([' ', '-'], '_', $estado);

        return $estado;
    }

    private function findProductoPrecio(int $productoId, ?string $presentacion): ?ProductoPrecio
    {
        $presentacion = trim((string) $presentacion);

        if ($productoId <= 0 || $presentacion === '') {
            return null;
        }

        return ProductoPrecio::query()
            ->where('producto_id', $productoId)
            ->whereRaw('LOWER(presentacion) = ?', [mb_strtolower($presentacion)])
            ->where('activo', true)
            ->first();
    }

    private function generarCodigo(): string
    {
        do {
            $codigo = 'PED-' . now()->format('YmdHis') . '-' . strtoupper(substr(uniqid(), -4));
        } while (Pedido::where('codigo', $codigo)->exists());

        return $codigo;
    }

    private function detalleResponse(PedidoDetalle $d): array
    {
        $precioConfig = $this->findProductoPrecio(
            (int) $d->producto_id,
            (string) $d->presentacion
        );

        $cantidad = (float) ($d->cantidad ?? 0);
        $precioVenta = (float) ($d->precio_unitario ?? 0);
        $precioCosto = (float) ($precioConfig?->precio_costo ?? 0);
        $precioVentaCatalogo = (float) ($precioConfig?->precio_venta ?? 0);
        $precioRutaCatalogo = (float) ($precioConfig?->precio_ruta ?? $precioConfig?->precio_venta ?? 0);
        $subtotal = (float) ($d->subtotal ?? 0);

        if ($subtotal <= 0) {
            $subtotal = $cantidad * $precioVenta;
        }

        $gananciaUnitaria = $precioVenta - $precioCosto;
        $gananciaTotal = $gananciaUnitaria * $cantidad;

        return [
            'id' => $d->id,
            'producto_id' => (int) $d->producto_id,
            'producto_nombre' => $d->producto?->nombre,
            'producto_sku' => $d->producto?->sku,
            'presentacion' => $d->presentacion,
            'cantidad' => $cantidad,
            'cantidad_base' => (int) ($d->cantidad_base ?? 0),

            'precio_costo' => $precioCosto,
            'precio_unitario' => $precioVenta,
            'precio_venta_catalogo' => $precioVentaCatalogo,
            'precio_ruta_catalogo' => $precioRutaCatalogo,

            'subtotal' => $subtotal,
            'ganancia_unitaria' => $gananciaUnitaria,
            'ganancia_total' => $gananciaTotal,

            'factor_base' => (float) ($precioConfig?->factor_base ?? 1),
            'es_monto_variable' => (bool) ($d->es_monto_variable ?? false),
        ];
    }

    private function pedidoResponse(Pedido $p): array
    {
        $detalles = $p->detalles->map(fn($d) => $this->detalleResponse($d))->values();
        $total = (float) ($p->total ?? $detalles->sum('subtotal'));
        $gananciaTotal = (float) $detalles->sum('ganancia_total');

        $vendedorNombre =
            $p->vendedor?->usuario?->usuario
            ?? $p->vendedor?->usuario?->nombre
            ?? $p->vendedor?->codigo
            ?? ($p->vendedor_id ? ('Vendedor #' . $p->vendedor_id) : null);

        $ruteroNombre =
            $p->rutero?->usuario
            ?? $p->rutero?->nombre
            ?? ($p->rutero_id ? ('Rutero #' . $p->rutero_id) : null);

        return [
            'id' => $p->id,
            'codigo' => $p->codigo ?: ('PED-' . $p->id),
            'estado' => $p->estado,

            'ubicacion_id' => $p->ubicacion_id,
            'ubicacion_nombre' => $p->ubicacion?->nombre,

            'cliente_id' => $p->cliente_id,
            'cliente_nombre' => $p->cliente?->nombre,

            'vendedor_id' => $p->vendedor_id,
            'vendedor_nombre' => $vendedorNombre,

            'rutero_id' => $p->rutero_id,
            'rutero_nombre' => $ruteroNombre,

            'ruta_id' => $p->ruta_id,
            'ruta_nombre' => $p->ruta?->nombre,

            'zona_id' => $p->zona_id,
            'zona_nombre' => $p->zona?->nombre,

            'observaciones' => $p->observaciones,
            'total' => $total,
            'ganancia_total' => $gananciaTotal,

            'creado_en' => optional($p->creado_en)->format('Y-m-d H:i:s'),
            'actualizado_en' => optional($p->actualizado_en)->format('Y-m-d H:i:s'),
            'fecha_en_ruta' => optional($p->fecha_en_ruta)->format('Y-m-d H:i:s'),
            'entregado_en' => optional($p->entregado_en)->format('Y-m-d H:i:s'),

            'rutero' => $p->rutero ? [
                'id' => (int) $p->rutero->id,
                'nombre' => $p->rutero->nombre,
                'usuario' => $p->rutero->usuario,
                'rol' => $p->rutero->rol,
                'ubicacion_id' => $p->rutero->ubicacion_id,
            ] : null,

            'detalles' => $detalles,
        ];
    }

    private function loadPedidoRelations(Pedido $pedido): Pedido
    {
        $pedido->load([
            'cliente:id,nombre,ruta_id,zona_id',
            'vendedor:id,codigo,usuario_id',
            'vendedor.usuario:id,usuario,nombre',
            'rutero:id,usuario,nombre,rol,ubicacion_id',
            'ruta:id,nombre',
            'zona:id,nombre',
            'ubicacion:id,nombre,tipo',
            'detalles.producto:id,nombre,sku',
        ]);

        return $pedido;
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $userUbicacionId = $this->userUbicacionId($user);
        $vendedorAuthId = $this->resolveVendedorId($user);

        $estado = $this->normalizeEstado($request->query('estado', ''));
        $vendedorId = $request->query('vendedor_id');
        $clienteId = $request->query('cliente_id');
        $qText = trim((string) $request->query('q', ''));
        $ubicacionId = $request->query('ubicacion_id');
        $perPage = max(1, (int) $request->query('per_page', 10));

        $query = Pedido::query()
            ->with([
                'cliente:id,nombre,ruta_id,zona_id',
                'vendedor:id,codigo,usuario_id',
                'vendedor.usuario:id,usuario,nombre',
                'rutero:id,usuario,nombre,rol,ubicacion_id',
                'ruta:id,nombre',
                'zona:id,nombre',
                'ubicacion:id,nombre,tipo',
                'detalles.producto:id,nombre,sku',
            ])
            ->orderByDesc('creado_en');

        if ($role === 'super_admin') {
            if ($ubicacionId) {
                $query->where('ubicacion_id', (int) $ubicacionId);
            }

            if ($vendedorId) {
                $query->where('vendedor_id', (int) $vendedorId);
            }
        } elseif ($role === 'admin_bodega') {
            if (!$userUbicacionId) {
                return response()->json([
                    'message' => 'El administrador de bodega no tiene una sucursal asignada.'
                ], 403);
            }

            $query->where('ubicacion_id', $userUbicacionId);

            if ($vendedorId) {
                $query->where('vendedor_id', (int) $vendedorId);
            }
        } elseif ($role === 'vendedor') {
            if (!$vendedorAuthId) {
                return response()->json([
                    'message' => 'No se encontró vendedor relacionado a este usuario.'
                ], 403);
            }

            $query->where('vendedor_id', $vendedorAuthId);

            if ($userUbicacionId) {
                $query->where('ubicacion_id', $userUbicacionId);
            }
        } elseif ($role === 'rutero') {
            $query->where('rutero_id', (int) $user->id);
        } else {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($estado !== '') {
            $query->where('estado', $estado);
        }

        if ($clienteId) {
            $query->where('cliente_id', (int) $clienteId);
        }

        if ($qText !== '') {
            $query->where(function ($sub) use ($qText) {
                $sub->where('codigo', 'like', "%{$qText}%")
                    ->orWhereHas('cliente', function ($q) use ($qText) {
                        $q->where('nombre', 'like', "%{$qText}%");
                    })
                    ->orWhereHas('vendedor.usuario', function ($q) use ($qText) {
                        $q->where('usuario', 'like', "%{$qText}%")
                            ->orWhere('nombre', 'like', "%{$qText}%");
                    })
                    ->orWhereHas('vendedor', function ($q) use ($qText) {
                        $q->where('codigo', 'like', "%{$qText}%");
                    })
                    ->orWhereHas('rutero', function ($q) use ($qText) {
                        $q->where('usuario', 'like', "%{$qText}%")
                            ->orWhere('nombre', 'like', "%{$qText}%");
                    });
            });
        }

        $page = $query->paginate($perPage);

        return response()->json([
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'data' => collect($page->items())
                ->map(fn($p) => $this->pedidoResponse($p))
                ->values(),
        ]);
    }

    public function misPedidos(Request $request)
    {
        $user = $request->user();
        $vendedorAuthId = $this->resolveVendedorId($user);
        $userUbicacionId = $this->userUbicacionId($user);
        $estado = $this->normalizeEstado($request->query('estado', ''));
        $perPage = max(1, (int) $request->query('per_page', 20));

        if (!$vendedorAuthId) {
            return response()->json([
                'message' => 'No se encontró vendedor relacionado a este usuario.'
            ], 403);
        }

        $query = Pedido::query()
            ->with([
                'cliente:id,nombre,ruta_id,zona_id',
                'vendedor:id,codigo,usuario_id',
                'vendedor.usuario:id,usuario,nombre',
                'rutero:id,usuario,nombre,rol,ubicacion_id',
                'ruta:id,nombre',
                'zona:id,nombre',
                'ubicacion:id,nombre,tipo',
                'detalles.producto:id,nombre,sku',
            ])
            ->where('vendedor_id', $vendedorAuthId)
            ->orderByDesc('creado_en');

        if ($userUbicacionId) {
            $query->where('ubicacion_id', $userUbicacionId);
        }

        if ($estado !== '') {
            $query->where('estado', $estado);
        }

        $page = $query->paginate($perPage);

        return response()->json([
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'data' => collect($page->items())
                ->map(fn($p) => $this->pedidoResponse($p))
                ->values(),
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $userUbicacionId = $this->userUbicacionId($user);
        $vendedorAuthId = $this->resolveVendedorId($user);

        if (!in_array($role, ['vendedor', 'admin_bodega', 'super_admin'], true)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $data = $request->validate([
            'ubicacion_id' => ['nullable', 'integer', 'exists:ubicaciones,id'],
            'cliente_id' => ['required', 'integer', 'exists:clientes,id'],
            'vendedor_id' => ['nullable', 'integer', 'exists:vendedores,id'],
            'ruta_id' => ['nullable', 'integer', 'exists:rutas,id'],
            'zona_id' => ['nullable', 'integer', 'exists:zonas,id'],
            'observaciones' => ['nullable', 'string'],
            'total' => ['nullable', 'numeric', 'min:0'],
            'detalles' => ['required', 'array', 'min:1'],
            'detalles.*.producto_id' => ['required', 'integer', 'exists:productos,id'],
            'detalles.*.presentacion' => ['required', 'string', 'max:50'],
            'detalles.*.cantidad' => ['required', 'numeric', 'min:0.01'],
            'detalles.*.cantidad_base' => ['required', 'integer', 'min:1'],
            'detalles.*.precio_unitario' => ['required', 'numeric', 'min:0'],
            'detalles.*.subtotal' => ['nullable', 'numeric', 'min:0'],
            'detalles.*.es_monto_variable' => ['nullable', Rule::in([0, 1, '0', '1', true, false])],
        ]);

        if ($role === 'vendedor') {
            if (!$userUbicacionId) {
                return response()->json([
                    'message' => 'El vendedor no tiene una sucursal asignada.'
                ], 403);
            }

            if (!$vendedorAuthId) {
                return response()->json([
                    'message' => 'No se encontró vendedor relacionado a este usuario.'
                ], 403);
            }

            $data['ubicacion_id'] = $userUbicacionId;
            $data['vendedor_id'] = $vendedorAuthId;
        }

        if ($role === 'admin_bodega') {
            if (!$userUbicacionId) {
                return response()->json([
                    'message' => 'El administrador de bodega no tiene una sucursal asignada.'
                ], 403);
            }

            $data['ubicacion_id'] = $userUbicacionId;

            if (empty($data['vendedor_id'])) {
                $data['vendedor_id'] = $vendedorAuthId ?: null;
            }
        }

        if ($role === 'super_admin') {
            $data['ubicacion_id'] = !empty($data['ubicacion_id']) ? (int) $data['ubicacion_id'] : null;
            $data['vendedor_id'] = !empty($data['vendedor_id'])
                ? (int) $data['vendedor_id']
                : ($vendedorAuthId ?: null);
        }

        if (empty($data['ubicacion_id'])) {
            return response()->json([
                'message' => 'Debes indicar la sucursal del pedido.'
            ], 422);
        }

        if (empty($data['vendedor_id'])) {
            return response()->json([
                'message' => 'No se encontró vendedor válido para este pedido.'
            ], 422);
        }

        return DB::transaction(function () use ($data) {
            /*
             * IMPORTANTE:
             * - Si NO es monto variable, el backend fuerza precio_ruta como precio del pedido.
             * - Si SÍ es monto variable, respeta el precio solicitado por el vendedor.
             * Así ya no depende del frontend y pedidos/ruteros no usarán precio_venta por error.
             */
            $detallesNormalizados = collect($data['detalles'])->map(function ($d) {
                $productoId = (int) $d['producto_id'];
                $presentacion = (string) $d['presentacion'];
                $cantidad = (float) ($d['cantidad'] ?? 0);
                $cantidadBase = (int) ($d['cantidad_base'] ?? 0);
                $esMontoVariable = !empty($d['es_monto_variable']);

                $precioConfig = $this->findProductoPrecio($productoId, $presentacion);

                $precioRutaCatalogo = (float) (
                    $precioConfig?->precio_ruta
                    ?? $precioConfig?->precio_venta
                    ?? $d['precio_unitario']
                    ?? 0
                );

                $precio = $esMontoVariable
                    ? (float) ($d['precio_unitario'] ?? 0)
                    : $precioRutaCatalogo;

                $subtotal = $cantidad * $precio;

                return [
                    'producto_id' => $productoId,
                    'presentacion' => $presentacion,
                    'cantidad' => $cantidad,
                    'cantidad_base' => $cantidadBase,
                    'precio_unitario' => $precio,
                    'subtotal' => $subtotal,
                    'es_monto_variable' => $esMontoVariable ? 1 : 0,
                ];
            })->values();

            $total = (float) $detallesNormalizados->sum('subtotal');

            $pedido = Pedido::create([
                'codigo' => $this->generarCodigo(),
                'ubicacion_id' => (int) $data['ubicacion_id'],
                'cliente_id' => (int) $data['cliente_id'],
                'vendedor_id' => (int) $data['vendedor_id'],
                'rutero_id' => null,
                'ruta_id' => !empty($data['ruta_id']) ? (int) $data['ruta_id'] : null,
                'zona_id' => !empty($data['zona_id']) ? (int) $data['zona_id'] : null,
                'estado' => 'pendiente_revision',
                'observaciones' => $data['observaciones'] ?? null,
                'total' => $total,
                'fecha_pedido' => now()->toDateString(),
                'fecha_en_ruta' => null,
                'canal' => 'ruta',
                'creado_en' => now(),
                'actualizado_en' => now(),
            ]);

            foreach ($detallesNormalizados as $d) {
                PedidoDetalle::create([
                    'pedido_id' => $pedido->id,
                    'producto_id' => (int) $d['producto_id'],
                    'presentacion' => $d['presentacion'],
                    'cantidad' => (float) $d['cantidad'],
                    'cantidad_base' => (int) $d['cantidad_base'],
                    'precio_unitario' => (float) $d['precio_unitario'],
                    'subtotal' => (float) $d['subtotal'],
                    'es_monto_variable' => !empty($d['es_monto_variable']) ? 1 : 0,
                ]);
            }

            $this->loadPedidoRelations($pedido);

            return response()->json([
                'message' => 'Pedido creado correctamente.',
                'data' => $this->pedidoResponse($pedido),
            ], 201);
        });
    }

    public function update(Pedido $pedido, Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $userUbicacionId = $this->userUbicacionId($user);

        if (!in_array($role, ['admin_bodega', 'super_admin'], true)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($role === 'admin_bodega' && (int) $pedido->ubicacion_id !== (int) $userUbicacionId) {
            return response()->json([
                'message' => 'No puedes editar pedidos de otra sucursal.'
            ], 403);
        }

        $data = $request->validate([
            'observaciones' => ['nullable', 'string'],
            'detalles' => ['required', 'array', 'min:1'],
            'detalles.*.id' => ['required', 'integer', 'exists:pedido_detalles,id'],
            'detalles.*.presentacion' => ['required', 'string', 'max:50'],
            'detalles.*.cantidad' => ['required', 'numeric', 'min:0.01'],
            'detalles.*.cantidad_base' => ['required', 'integer', 'min:1'],
            'detalles.*.precio_unitario' => ['required', 'numeric', 'min:0'],
            'detalles.*.subtotal' => ['nullable', 'numeric', 'min:0'],
            'detalles.*.es_monto_variable' => ['nullable', Rule::in([0, 1, '0', '1', true, false])],
        ]);

        return DB::transaction(function () use ($pedido, $data) {
            if (array_key_exists('observaciones', $data)) {
                $pedido->observaciones = $data['observaciones'];
            }

            foreach ($data['detalles'] as $d) {
                $det = PedidoDetalle::query()
                    ->where('pedido_id', $pedido->id)
                    ->where('id', (int) $d['id'])
                    ->firstOrFail();

                $cantidad = (float) $d['cantidad'];
                $precio = (float) $d['precio_unitario'];
                $subtotal = array_key_exists('subtotal', $d)
                    ? (float) $d['subtotal']
                    : ($cantidad * $precio);

                $det->presentacion = $d['presentacion'];
                $det->cantidad = $cantidad;
                $det->cantidad_base = (int) $d['cantidad_base'];
                $det->precio_unitario = $precio;
                $det->subtotal = $subtotal;
                $det->es_monto_variable = !empty($d['es_monto_variable']) ? 1 : 0;
                $det->save();
            }

            $pedido->total = (float) $pedido->detalles()->sum('subtotal');
            $pedido->actualizado_en = now();
            $pedido->save();

            $this->loadPedidoRelations($pedido);

            return response()->json([
                'message' => 'Pedido actualizado correctamente.',
                'data' => $this->pedidoResponse($pedido),
            ]);
        });
    }

    public function enviar(Pedido $pedido, Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $vendedorAuthId = $this->resolveVendedorId($user);

        if ($role !== 'vendedor') {
            return response()->json([
                'message' => 'Solo un vendedor puede enviar pedidos.'
            ], 403);
        }

        if (!$vendedorAuthId || (int) $pedido->vendedor_id !== $vendedorAuthId) {
            return response()->json([
                'message' => 'No puedes enviar un pedido que no es tuyo.'
            ], 403);
        }

        if (!in_array($pedido->estado, ['borrador', 'pendiente_revision'], true)) {
            return response()->json([
                'message' => 'Este pedido ya no se puede enviar.'
            ], 422);
        }

        $pedido->estado = 'pendiente_revision';
        $pedido->actualizado_en = now();
        $pedido->save();

        $this->loadPedidoRelations($pedido);

        return response()->json([
            'message' => 'Pedido enviado al administrador de bodega.',
            'data' => $this->pedidoResponse($pedido),
        ]);
    }

    public function aprobar(Pedido $pedido, Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $userUbicacionId = $this->userUbicacionId($user);

        if (!in_array($role, ['admin_bodega', 'super_admin'], true)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($role === 'admin_bodega' && (int) $pedido->ubicacion_id !== (int) $userUbicacionId) {
            return response()->json([
                'message' => 'No puedes aprobar pedidos de otra sucursal.'
            ], 403);
        }

        if (!in_array($pedido->estado, ['pendiente_revision', 'borrador'], true)) {
            return response()->json([
                'message' => 'El pedido no está en estado válido para aprobar.'
            ], 422);
        }

        $data = $request->validate([
            'observaciones' => ['nullable', 'string'],
            'detalles' => ['nullable', 'array'],
            'detalles.*.id' => ['required', 'integer', 'exists:pedido_detalles,id'],
            'detalles.*.presentacion' => ['nullable', 'string', 'max:50'],
            'detalles.*.cantidad' => ['nullable', 'numeric', 'min:0.01'],
            'detalles.*.cantidad_base' => ['nullable', 'integer', 'min:1'],
            'detalles.*.precio_unitario' => ['nullable', 'numeric', 'min:0'],
            'detalles.*.subtotal' => ['nullable', 'numeric', 'min:0'],
            'detalles.*.es_monto_variable' => ['nullable', Rule::in([0, 1, '0', '1', true, false])],
        ]);

        return DB::transaction(function () use ($pedido, $data) {
            if (array_key_exists('observaciones', $data)) {
                $pedido->observaciones = $data['observaciones'];
            }

            if (!empty($data['detalles'])) {
                foreach ($data['detalles'] as $d) {
                    $det = PedidoDetalle::query()
                        ->where('pedido_id', $pedido->id)
                        ->where('id', (int) $d['id'])
                        ->firstOrFail();

                    if (array_key_exists('presentacion', $d)) {
                        $det->presentacion = $d['presentacion'];
                    }

                    if (array_key_exists('cantidad', $d)) {
                        $det->cantidad = $d['cantidad'] !== null ? (float) $d['cantidad'] : null;
                    }

                    if (array_key_exists('cantidad_base', $d)) {
                        $det->cantidad_base = (int) $d['cantidad_base'];
                    }

                    if (array_key_exists('precio_unitario', $d)) {
                        $det->precio_unitario = (float) $d['precio_unitario'];
                    }

                    $cantidadActual = array_key_exists('cantidad', $d)
                        ? (float) $d['cantidad']
                        : (float) ($det->cantidad ?? 0);

                    $precioActual = array_key_exists('precio_unitario', $d)
                        ? (float) $d['precio_unitario']
                        : (float) ($det->precio_unitario ?? 0);

                    if (array_key_exists('subtotal', $d)) {
                        $det->subtotal = (float) $d['subtotal'];
                    } else {
                        $det->subtotal = $cantidadActual * $precioActual;
                    }

                    if (array_key_exists('es_monto_variable', $d)) {
                        $det->es_monto_variable = !empty($d['es_monto_variable']) ? 1 : 0;
                    }

                    $det->save();
                }
            }

            $pedido->total = (float) $pedido->detalles()->sum('subtotal');
            $pedido->estado = 'aprobado';
            $pedido->actualizado_en = now();
            $pedido->save();

            $this->loadPedidoRelations($pedido);

            return response()->json([
                'message' => 'Pedido aprobado.',
                'data' => $this->pedidoResponse($pedido),
            ]);
        });
    }

    public function preparar(Pedido $pedido, Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $userUbicacionId = $this->userUbicacionId($user);

        if (!in_array($role, ['admin_bodega', 'super_admin'], true)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($role === 'admin_bodega' && (int) $pedido->ubicacion_id !== (int) $userUbicacionId) {
            return response()->json([
                'message' => 'No puedes preparar pedidos de otra sucursal.'
            ], 403);
        }

        if ($pedido->estado !== 'aprobado') {
            return response()->json([
                'message' => 'Solo se puede preparar un pedido aprobado.'
            ], 422);
        }

        $pedido->estado = 'preparando';
        $pedido->actualizado_en = now();
        $pedido->save();

        $this->loadPedidoRelations($pedido);

        return response()->json([
            'message' => 'Pedido marcado como preparando.',
            'data' => $this->pedidoResponse($pedido),
        ]);
    }

public function entregar(Pedido $pedido, Request $request)
{
    $user = $request->user();
    $role = $this->roleOf($user);
    $vendedorAuthId = $this->resolveVendedorId($user);

    if (!in_array($role, ['vendedor', 'super_admin', 'rutero'], true)) {
        return response()->json(['message' => 'No autorizado.'], 403);
    }

    if ($role === 'vendedor' && (!$vendedorAuthId || (int) $pedido->vendedor_id !== $vendedorAuthId)) {
        return response()->json([
            'message' => 'No puedes entregar pedidos de otro vendedor.'
        ], 403);
    }

    if ($role === 'rutero' && (int) $pedido->rutero_id !== (int) $user->id) {
        return response()->json([
            'message' => 'No puedes entregar un pedido que no te fue asignado.'
        ], 403);
    }

    if (!in_array($pedido->estado, ['preparando', 'aprobado', 'en_ruta'], true)) {
        return response()->json([
            'message' => 'Solo se puede entregar un pedido preparado.'
        ], 422);
    }

    $data = $request->validate([
        'metodo_pago' => ['nullable', 'string', Rule::in(['efectivo', 'tarjeta', 'cuotas'])],
        'nombre_pagador' => ['nullable', 'string', 'max:150'],
        'referencia_pago' => ['nullable', 'string', 'max:150'],
        'observacion_entrega' => ['nullable', 'string'],
        'cliente_id' => ['nullable', 'integer', 'exists:clientes,id'],
    ]);

    return DB::transaction(function () use ($pedido, $data, $user) {
        $metodoPago = strtolower((string) ($data['metodo_pago'] ?? 'efectivo'));
        $userId = (int) ($user->id ?? 0);
        $ubicacionId = (int) $pedido->ubicacion_id;

        $caja = Caja::query()
            ->where('ubicacion_id', $ubicacionId)
            ->where('estado', 'abierta')
            ->latest('id')
            ->first();

        if (property_exists($pedido, 'metodo_pago') || isset($pedido->metodo_pago)) {
            $pedido->metodo_pago = $metodoPago;
        }

        if ($metodoPago === 'cuotas' && !empty($data['cliente_id'])) {
            $pedido->cliente_id = (int) $data['cliente_id'];
        }

        if (!empty($data['observacion_entrega'])) {
            $obsActual = trim((string) ($pedido->observaciones ?? ''));
            $obsNueva = trim((string) $data['observacion_entrega']);

            $pedido->observaciones = $obsActual !== ''
                ? $obsActual . "\n" . $obsNueva
                : $obsNueva;
        }

        $pedido->estado = 'entregado';
        $pedido->actualizado_en = now();
        $pedido->entregado_en = now();
        $pedido->save();

        if (in_array($metodoPago, ['efectivo', 'tarjeta'], true) && $caja) {
            MovimientoCaja::create([
                'caja_id' => (int) $caja->id,
                'ubicacion_id' => $ubicacionId,
                'usuario_id' => $userId,
                'tipo' => 'ingreso',
                'concepto' => 'venta_rutero',
                'monto' => round((float) $pedido->total, 2),
                'metodo_pago' => $metodoPago,
                'referencia_id' => (int) $pedido->id,
                'referencia_tipo' => 'pedido',
                'notas' => 'Cobro de pedido entregado por rutero'
                    . (!empty($data['nombre_pagador']) ? ' | Pagador: ' . $data['nombre_pagador'] : '')
                    . (!empty($data['referencia_pago']) ? ' | Ref: ' . $data['referencia_pago'] : ''),
            ]);
        }

        $this->loadPedidoRelations($pedido);

        return response()->json([
            'success' => true,
            'message' => $metodoPago === 'cuotas'
                ? 'Pedido entregado a crédito correctamente.'
                : 'Pedido entregado y cobrado correctamente.',
            'data' => $this->pedidoResponse($pedido),
        ]);
    });
}

public function asignarRutero(Request $request, Pedido $pedido)
{
    $user = $request->user();
    $role = $this->roleOf($user);
    $userUbicacionId = $this->userUbicacionId($user);

    if (!in_array($role, ['admin_bodega', 'super_admin'], true)) {
        return response()->json(['message' => 'No autorizado.'], 403);
    }

    if ($role === 'admin_bodega' && (int) $pedido->ubicacion_id !== (int) $userUbicacionId) {
        return response()->json([
            'message' => 'No puedes asignar rutero a pedidos de otra sucursal.'
        ], 403);
    }

    if (!in_array($pedido->estado, ['pendiente_revision', 'borrador', 'aprobado'], true)) {
        return response()->json([
            'message' => 'Este pedido no se puede asignar y aprobar en su estado actual.'
        ], 422);
    }

    $data = $request->validate([
        'rutero_id' => ['required', 'integer', 'exists:usuarios,id'],
        'observaciones' => ['nullable', 'string'],
        'detalles' => ['required', 'array', 'min:1'],
        'detalles.*.id' => ['required', 'integer', 'exists:pedido_detalles,id'],
        'detalles.*.presentacion' => ['required', 'string', 'max:50'],
        'detalles.*.cantidad' => ['required', 'numeric', 'min:0.01'],
        'detalles.*.cantidad_base' => ['required', 'integer', 'min:1'],
        'detalles.*.precio_unitario' => ['required', 'numeric', 'min:0'],
        'detalles.*.subtotal' => ['nullable', 'numeric', 'min:0'],
        'detalles.*.es_monto_variable' => ['nullable', Rule::in([0, 1, '0', '1', true, false])],
    ]);

    $rutero = Usuario::findOrFail((int) $data['rutero_id']);

    $ruteroRole = strtolower((string) ($rutero->rol ?? $rutero->role ?? ''));
    $ruteroRole = str_replace([' ', '-'], '_', $ruteroRole);

    if ($ruteroRole !== 'rutero') {
        return response()->json([
            'message' => 'El usuario seleccionado no es un rutero.'
        ], 422);
    }

    if (!empty($rutero->ubicacion_id) && (int) $rutero->ubicacion_id !== (int) $pedido->ubicacion_id) {
        return response()->json([
            'message' => 'No puedes asignar un rutero de otra sucursal.'
        ], 422);
    }

    try {
        return DB::transaction(function () use ($pedido, $data, $rutero, $user) {
            $userId = (int) ($user->id ?? 0);
            $ubicacionId = (int) $pedido->ubicacion_id;

            if (array_key_exists('observaciones', $data)) {
                $pedido->observaciones = $data['observaciones'];
            }

            foreach ($data['detalles'] as $d) {
                $det = PedidoDetalle::query()
                    ->where('pedido_id', $pedido->id)
                    ->where('id', (int) $d['id'])
                    ->firstOrFail();

                $cantidad = (float) $d['cantidad'];
                $precio = (float) $d['precio_unitario'];
                $subtotal = array_key_exists('subtotal', $d)
                    ? (float) $d['subtotal']
                    : ($cantidad * $precio);

                $det->presentacion = $d['presentacion'];
                $det->cantidad = $cantidad;
                $det->cantidad_base = (int) $d['cantidad_base'];
                $det->precio_unitario = $precio;
                $det->subtotal = $subtotal;

                if (array_key_exists('es_monto_variable', $d)) {
                    $det->es_monto_variable = !empty($d['es_monto_variable']) ? 1 : 0;
                }

                $det->save();
            }

            $pedido->refresh();
            $pedido->loadMissing([
                'detalles.producto:id,nombre,sku',
            ]);

            $descontarStock = in_array($pedido->estado, ['pendiente_revision', 'borrador'], true);

            if ($descontarStock) {
                foreach ($pedido->detalles as $det) {
                    $precio = ProductoPrecio::query()
                        ->where('producto_id', (int) $det->producto_id)
                        ->whereRaw('LOWER(presentacion) = ?', [mb_strtolower(trim((string) $det->presentacion))])
                        ->where('activo', true)
                        ->first();

                    if (!$precio) {
                        return response()->json([
                            'message' => 'No existe la presentación '
                                . ($det->presentacion ?? 'sin nombre')
                                . ' para el producto '
                                . ($det->producto?->nombre ?? ('#' . $det->producto_id)) . '.'
                        ], 422);
                    }

                    $cantidad = (float) ($det->cantidad ?? 0);

                    if ($cantidad <= 0) {
                        return response()->json([
                            'message' => 'La cantidad del producto '
                                . ($det->producto?->nombre ?? ('#' . $det->producto_id))
                                . ' no es válida.'
                        ], 422);
                    }

                    $this->stockService->apply([
                        'tipo' => 'salida',
                        'ubicacion_origen_id' => $ubicacionId,
                        'producto_id' => (int) $det->producto_id,
                        'presentacion' => $precio->presentacion,
                        'cantidad' => (int) round($cantidad),
                        'motivo' => "Salida por aprobación de pedido #{$pedido->id}",
                        'referencia_tipo' => 'pedido',
                        'referencia_id' => (int) $pedido->id,
                    ], $userId);
                }
            }

            $pedido->total = (float) $pedido->detalles()->sum('subtotal');
            $pedido->rutero_id = (int) $rutero->id;
            $pedido->estado = 'aprobado';
            $pedido->actualizado_en = now();
            $pedido->save();

            $this->loadPedidoRelations($pedido);

            return response()->json([
                'message' => $descontarStock
                    ? 'Rutero asignado, pedido aprobado y stock descontado correctamente.'
                    : 'Rutero asignado y pedido actualizado correctamente.',
                'data' => $this->pedidoResponse($pedido),
            ]);
        });
    } catch (\Throwable $e) {
        return response()->json([
            'message' => $e->getMessage() ?: 'No se pudo asignar, aprobar y descontar stock.'
        ], 422);
    }
}

    public function misEntregas(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);

        if (!in_array($role, ['rutero', 'super_admin'], true)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $ruteroId = $role === 'rutero'
            ? (int) $user->id
            : (int) $request->query('rutero_id', 0);

        $estado = $this->normalizeEstado($request->query('estado', ''));
        $fechaDesde = trim((string) $request->query('fecha_desde', ''));
        $fechaHasta = trim((string) $request->query('fecha_hasta', ''));
        $perPage = max(1, min(100, (int) $request->query('per_page', 50)));

        $scope = Pedido::query()
            ->whereNotNull('rutero_id');

        if ($ruteroId > 0) {
            $scope->where('rutero_id', $ruteroId);
        }

        if ($estado !== '') {
            $scope->where('estado', $estado);
        }

        if ($fechaDesde !== '') {
            $scope->whereDate(DB::raw('COALESCE(entregado_en, creado_en)'), '>=', $fechaDesde);
        }

        if ($fechaHasta !== '') {
            $scope->whereDate(DB::raw('COALESCE(entregado_en, creado_en)'), '<=', $fechaHasta);
        }

        $query = (clone $scope)
            ->with([
                'cliente:id,nombre,ruta_id,zona_id',
                'vendedor:id,codigo,usuario_id',
                'vendedor.usuario:id,usuario,nombre',
                'rutero:id,usuario,nombre,rol,ubicacion_id',
                'ruta:id,nombre',
                'zona:id,nombre',
                'ubicacion:id,nombre,tipo',
                'detalles.producto:id,nombre,sku',
            ])
            ->orderByDesc('creado_en');

        $page = $query->paginate($perPage);
        $pedidoIdsPagina = collect($page->items())->pluck('id')->map(fn ($id) => (int) $id)->all();

        $movimientosPagina = empty($pedidoIdsPagina)
            ? collect()
            : MovimientoCaja::query()
                ->where('tipo', 'ingreso')
                ->where('referencia_tipo', 'pedido')
                ->whereIn('referencia_id', $pedidoIdsPagina)
                ->orderByDesc('creado_en')
                ->get()
                ->unique('referencia_id')
                ->keyBy('referencia_id');

        $movimientosResumen = MovimientoCaja::query()
            ->where('tipo', 'ingreso')
            ->where('referencia_tipo', 'pedido')
            ->whereIn('referencia_id', (clone $scope)->select('id'));

        if ($ruteroId > 0) {
            $movimientosResumen->where('usuario_id', $ruteroId);
        }

        if ($fechaDesde !== '') {
            $movimientosResumen->whereDate('creado_en', '>=', $fechaDesde);
        }

        if ($fechaHasta !== '') {
            $movimientosResumen->whereDate('creado_en', '<=', $fechaHasta);
        }

        $totalDineroRecibido = round((float) (clone $movimientosResumen)->sum('monto'), 2);
        $totalEntregasCobradas = (int) (clone $movimientosResumen)->distinct()->count('referencia_id');

        $pendientesCobro = (clone $scope)
            ->where('estado', 'entregado')
            ->whereNotExists(function ($sub) {
                $sub->select(DB::raw(1))
                    ->from('movimientos_caja as mc')
                    ->whereColumn('mc.referencia_id', 'pedidos.id')
                    ->where('mc.referencia_tipo', 'pedido')
                    ->where('mc.tipo', 'ingreso');
            })
            ->count();

        $data = collect($page->items())->map(function ($pedido) use ($movimientosPagina) {
            $row = $this->pedidoResponse($pedido);
            $mov = $movimientosPagina->get((int) $pedido->id);

            $row['cobro'] = $mov ? [
                'registrado' => true,
                'monto' => (float) ($mov->monto ?? 0),
                'metodo_pago' => $mov->metodo_pago,
                'recibido_por' => $mov->usuario_id ? (int) $mov->usuario_id : null,
                'creado_en' => optional($mov->creado_en)->format('Y-m-d H:i:s'),
            ] : [
                'registrado' => false,
                'monto' => 0,
                'metodo_pago' => null,
                'recibido_por' => null,
                'creado_en' => null,
            ];

            return $row;
        })->values();

        return response()->json([
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'resumen' => [
                'rutero_id' => $ruteroId > 0 ? $ruteroId : null,
                'total_entregas_cobradas' => $totalEntregasCobradas,
                'total_dinero_recibido' => $totalDineroRecibido,
                'entregas_pendientes_cobro' => (int) $pendientesCobro,
            ],
            'data' => $data,
        ]);
    }

    public function misPedidosRutero(Request $request)
    {
        $user = $request->user();
        $soloActivos = $request->boolean('solo_activos', true);

        $query = Pedido::query()
            ->with([
                'cliente:id,nombre,ruta_id,zona_id',
                'vendedor:id,codigo,usuario_id',
                'vendedor.usuario:id,usuario,nombre',
                'rutero:id,usuario,nombre,rol,ubicacion_id',
                'ruta:id,nombre',
                'zona:id,nombre',
                'ubicacion:id,nombre,tipo',
                'detalles.producto:id,nombre,sku',
            ])
            ->where('rutero_id', (int) $user->id)
            ->orderByDesc('creado_en');

        if ($soloActivos) {
            $query->whereIn('estado', ['aprobado', 'preparando', 'en_ruta']);
        }

        $pedidos = $query->get();

        return response()->json([
            'data' => $pedidos->map(fn($p) => $this->pedidoResponse($p))->values(),
        ]);
    }
}