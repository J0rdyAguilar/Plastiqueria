<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pedido;
use App\Models\PedidoDetalle;
use App\Models\Stock;
use App\Models\MovimientoStock;
use App\Models\Vendedor;
use App\Services\StockService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class VentaTiendaController extends Controller
{
    public function __construct(private StockService $stockService) {}

    private function roleOf($user): string
    {
        $r = strtolower((string) ($user->rol ?? $user->role ?? ''));
        if ($r === 'superadmin') return 'super_admin';
        if ($r === 'cajero') return 'caja';
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

    private function detalleResponse(PedidoDetalle $d): array
    {
        return [
            'id' => $d->id,
            'producto_id' => (int) $d->producto_id,
            'producto_nombre' => $d->producto?->nombre,
            'presentacion' => $d->presentacion,
            'cantidad' => (float) ($d->cantidad ?? 0),
            'cantidad_base' => (int) ($d->cantidad_base ?? 0),
            'precio_unitario' => (float) ($d->precio_unitario ?? 0),
            'subtotal' => (float) ($d->subtotal ?? 0),
            'es_monto_variable' => (bool) ($d->es_monto_variable ?? false),
        ];
    }

    private function pedidoResponse(Pedido $p): array
    {
        $detalles = $p->detalles->map(fn ($d) => $this->detalleResponse($d))->values();
        $total = (float) ($p->total ?? $detalles->sum('subtotal'));

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
            'codigo' => $p->codigo,
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

            'creado_en' => optional($p->creado_en)->format('Y-m-d H:i:s'),
            'actualizado_en' => optional($p->actualizado_en)->format('Y-m-d H:i:s'),
            'fecha_en_ruta' => optional($p->fecha_en_ruta)->format('Y-m-d H:i:s'),
            'entregado_en' => optional($p->entregado_en)->format('Y-m-d H:i:s'),

            'rutero' => $p->rutero ? [
                'id' => (int) $p->rutero->id,
                'nombre' => $p->rutero->nombre,
                'usuario' => $p->rutero->usuario,
                'rol' => $p->rutero->rol,
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
            'rutero:id,usuario,nombre,rol',
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
                'rutero:id,usuario,nombre,rol',
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
        } elseif ($role === 'admin') {
            if (!$userUbicacionId) {
                return response()->json([
                    'message' => 'El admin no tiene una sucursal asignada.'
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
                ->map(fn ($p) => $this->pedidoResponse($p))
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
                'rutero:id,usuario,nombre,rol',
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
                ->map(fn ($p) => $this->pedidoResponse($p))
                ->values(),
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $userUbicacionId = $this->userUbicacionId($user);
        $vendedorAuthId = $this->resolveVendedorId($user);

        if (!in_array($role, ['vendedor', 'admin', 'super_admin'], true)) {
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
            'detalles.*.cantidad' => ['nullable', 'numeric', 'min:0.01'],
            'detalles.*.cantidad_base' => ['required', 'integer', 'min:1'],
            'detalles.*.precio_unitario' => ['required', 'numeric', 'min:0'],
            'detalles.*.subtotal' => ['required', 'numeric', 'min:0'],
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

        if ($role === 'admin') {
            if (!$userUbicacionId) {
                return response()->json([
                    'message' => 'El admin no tiene una sucursal asignada.'
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
            $total = collect($data['detalles'])->sum(fn ($d) => (float) $d['subtotal']);

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

            foreach ($data['detalles'] as $d) {
                PedidoDetalle::create([
                    'pedido_id' => $pedido->id,
                    'producto_id' => (int) $d['producto_id'],
                    'presentacion' => $d['presentacion'],
                    'cantidad' => isset($d['cantidad']) ? (float) $d['cantidad'] : null,
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
            'message' => 'Pedido enviado al admin.',
            'data' => $this->pedidoResponse($pedido),
        ]);
    }

    public function aprobar(Pedido $pedido, Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $userUbicacionId = $this->userUbicacionId($user);
        $userId = (int) ($user->id ?? 0);

        if (!in_array($role, ['admin', 'super_admin'], true)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($role === 'admin' && (int) $pedido->ubicacion_id !== (int) $userUbicacionId) {
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

        return DB::transaction(function () use ($pedido, $data, $userId) {
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

                    if (array_key_exists('subtotal', $d)) {
                        $det->subtotal = (float) $d['subtotal'];
                    } else {
                        $cantidadReal = (float) ($det->cantidad ?? 0);
                        $det->subtotal = $cantidadReal * (float) $det->precio_unitario;
                    }

                    if (array_key_exists('es_monto_variable', $d)) {
                        $det->es_monto_variable = !empty($d['es_monto_variable']) ? 1 : 0;
                    }

                    $det->save();
                }
            }

            $detalles = $pedido->detalles()->with('producto')->lockForUpdate()->get();

            foreach ($detalles as $det) {
                $cantidadDescontar = (float) ($det->cantidad ?? 0);

                if ($cantidadDescontar <= 0) {
                    throw ValidationException::withMessages([
                        'stock' => ["La cantidad del producto {$det->producto_id} debe ser mayor a 0."],
                    ]);
                }

                $stock = Stock::query()
                    ->where('ubicacion_id', (int) $pedido->ubicacion_id)
                    ->where('producto_id', (int) $det->producto_id)
                    ->lockForUpdate()
                    ->first();

                if (!$stock) {
                    throw ValidationException::withMessages([
                        'stock' => ["No existe stock para el producto {$det->producto_id} en esta sucursal."],
                    ]);
                }

                $stockDisponible = (float) ($stock->cantidad ?? 0);

                if ($stockDisponible < $cantidadDescontar) {
                    $nombreProducto = $det->producto?->nombre ?: "Producto {$det->producto_id}";

                    throw ValidationException::withMessages([
                        'stock' => [
                            "Stock insuficiente para {$nombreProducto}. Disponible: {$stockDisponible}."
                        ],
                    ]);
                }

                $stock->cantidad = max(0, (float) $stock->cantidad - $cantidadDescontar);
                $stock->save();

                MovimientoStock::create([
                    'tipo'                 => 'salida',
                    'ubicacion_origen_id'  => (int) $pedido->ubicacion_id,
                    'ubicacion_destino_id' => null,
                    'producto_id'          => (int) $det->producto_id,
                    'producto_precio_id'   => $stock->producto_precio_id ?? null,
                    'presentacion'         => $det->presentacion,
                    'factor_aplicado'      => 1,
                    'cantidad'             => $cantidadDescontar,
                    'cantidad_base'        => 0,
                    'motivo'               => 'pedido_aprobado',
                    'referencia_tipo'      => 'pedido',
                    'referencia_id'        => (int) $pedido->id,
                    'creado_por'           => $userId,
                    'creado_en'            => now(),
                ]);
            }

            $pedido->total = (float) $pedido->detalles()->sum('subtotal');
            $pedido->estado = 'aprobado';
            $pedido->actualizado_en = now();
            $pedido->save();

            $this->loadPedidoRelations($pedido);

            return response()->json([
                'message' => 'Pedido aprobado y stock descontado correctamente.',
                'data' => $this->pedidoResponse($pedido),
            ]);
        });
    }

    public function preparar(Pedido $pedido, Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $userUbicacionId = $this->userUbicacionId($user);

        if (!in_array($role, ['admin', 'super_admin'], true)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($role === 'admin' && (int) $pedido->ubicacion_id !== (int) $userUbicacionId) {
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
        $userUbicacionId = $this->userUbicacionId($user);
        $vendedorAuthId = $this->resolveVendedorId($user);

        if (!in_array($role, ['vendedor', 'admin', 'super_admin', 'rutero'], true)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($role === 'admin' && (int) $pedido->ubicacion_id !== (int) $userUbicacionId) {
            return response()->json([
                'message' => 'No puedes entregar pedidos de otra sucursal.'
            ], 403);
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

        $pedido->estado = 'entregado';
        $pedido->actualizado_en = now();
        $pedido->entregado_en = now();
        $pedido->save();

        $this->loadPedidoRelations($pedido);

        return response()->json([
            'message' => 'Pedido entregado.',
            'data' => $this->pedidoResponse($pedido),
        ]);
    }

    public function asignarRutero(Request $request, Pedido $pedido)
    {
        $data = $request->validate([
            'rutero_id' => ['required', 'integer', 'exists:usuarios,id'],
        ]);

        $rutero = \App\Models\Usuario::findOrFail($data['rutero_id']);

        if ($rutero->rol !== 'rutero') {
            return response()->json([
                'message' => 'El usuario seleccionado no es un rutero.'
            ], 422);
        }

        $pedido->rutero_id = $rutero->id;
        $pedido->estado = 'en_ruta';
        $pedido->fecha_en_ruta = now();
        $pedido->actualizado_en = now();
        $pedido->save();

        $this->loadPedidoRelations($pedido);

        return response()->json([
            'message' => 'Rutero asignado correctamente.',
            'pedido' => $this->pedidoResponse($pedido),
        ]);
    }

    public function misEntregas(Request $request)
    {
        $user = $request->user();

        $query = Pedido::with([
            'cliente:id,nombre,ruta_id,zona_id',
            'vendedor:id,codigo,usuario_id',
            'vendedor.usuario:id,usuario,nombre',
            'rutero:id,usuario,nombre,rol',
            'ruta:id,nombre',
            'zona:id,nombre',
            'ubicacion:id,nombre,tipo',
            'detalles.producto:id,nombre,sku',
        ])->where('rutero_id', $user->id)
          ->orderByDesc('creado_en');

        $estado = $this->normalizeEstado($request->query('estado', ''));
        if ($estado !== '') {
            $query->where('estado', $estado);
        }

        $page = $query->paginate(50);

        return response()->json([
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'data' => collect($page->items())
                ->map(fn ($p) => $this->pedidoResponse($p))
                ->values(),
        ]);
    }

    private function generarCodigo(): string
    {
        return 'PED-' . now()->format('Ymd-His') . '-' . random_int(100, 999);
    }
}