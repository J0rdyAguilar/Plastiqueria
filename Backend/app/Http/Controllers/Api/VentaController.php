<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Caja;
use App\Models\Cliente;
use App\Models\MovimientoCaja;
use App\Models\Venta;
use App\Models\VentaDetalle;
use App\Models\Vendedor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class VentaController extends Controller
{
    private function roleOf($user): string
    {
        $r = strtolower((string) ($user->rol ?? $user->role ?? ''));
        if ($r === 'superadmin') return 'super_admin';
        if ($r === 'cajero') return 'caja';
        return $r;
    }

    private function userUbicacionId($user): ?int
    {
        $id = $user->ubicacion_id ?? null;
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

        return str_replace([' ', '-'], '_', mb_strtolower($estado));
    }

    private function loadVentaRelations(Venta $venta): Venta
    {
        $venta->load([
            'cliente:id,nombre',
            'vendedor:id,codigo,usuario_id',
            'vendedor.usuario:id,nombre,usuario',
            'rutero:id,nombre,usuario,rol',
            'ruta:id,nombre',
            'zona:id,nombre',
            'ubicacion:id,nombre,tipo',
            'detalles.producto:id,nombre,sku',
        ]);

        return $venta;
    }

    private function ventaResponse(Venta $venta): array
    {
        $vendedorNombre =
            $venta->vendedor?->usuario?->nombre
            ?? $venta->vendedor?->usuario?->usuario
            ?? $venta->vendedor?->codigo
            ?? ($venta->vendedor_id ? ('Vendedor #' . $venta->vendedor_id) : null);

        $ruteroNombre =
            $venta->rutero?->nombre
            ?? $venta->rutero?->usuario
            ?? ($venta->rutero_id ? ('Rutero #' . $venta->rutero_id) : null);

        return [
            'id' => $venta->id,

            'cliente_id' => $venta->cliente_id,
            'cliente_nombre' => $venta->cliente?->nombre,

            'vendedor_id' => $venta->vendedor_id,
            'vendedor_nombre' => $vendedorNombre,

            'rutero_id' => $venta->rutero_id,
            'rutero_nombre' => $ruteroNombre,

            'ubicacion_id' => $venta->ubicacion_id,
            'ubicacion_nombre' => $venta->ubicacion?->nombre,

            'ruta_id' => $venta->ruta_id,
            'ruta_nombre' => $venta->ruta?->nombre,

            'zona_id' => $venta->zona_id,
            'zona_nombre' => $venta->zona?->nombre,

            'estado' => $venta->estado,
            'total' => (float) $venta->total,
            'observaciones' => $venta->observaciones,
            'metodo_pago' => $venta->metodo_pago,

            'creado_en' => optional($venta->creado_en)?->format('Y-m-d H:i:s'),
            'actualizado_en' => optional($venta->actualizado_en)?->format('Y-m-d H:i:s'),
            'fecha_en_ruta' => optional($venta->fecha_en_ruta)?->format('Y-m-d H:i:s'),
            'entregado_en' => optional($venta->entregado_en)?->format('Y-m-d H:i:s'),

            'rutero' => $venta->rutero ? [
                'id' => (int) $venta->rutero->id,
                'nombre' => $venta->rutero->nombre,
                'usuario' => $venta->rutero->usuario,
                'rol' => $venta->rutero->rol,
            ] : null,

            'detalles' => $venta->detalles->map(function ($d) {
                return [
                    'id' => $d->id,
                    'producto_id' => $d->producto_id,
                    'producto_nombre' => $d->producto?->nombre,
                    'presentacion' => $d->presentacion,
                    'cantidad' => (float) ($d->cantidad ?? 0),
                    'cantidad_base' => (float) $d->cantidad_base,
                    'precio_unitario' => (float) $d->precio_unitario,
                    'subtotal' => (float) $d->subtotal,
                    'es_monto_variable' => (bool) ($d->es_monto_variable ?? false),
                ];
            })->values(),
        ];
    }

    public function storePedidoVendedor(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $ubicacionAuthId = $this->userUbicacionId($user);
        $vendedorAuthId = $this->resolveVendedorId($user);

        if ($role !== 'vendedor') {
            return response()->json([
                'message' => 'Solo un vendedor puede crear este pedido.'
            ], 403);
        }

        if (!$ubicacionAuthId) {
            return response()->json([
                'message' => 'El vendedor no tiene sucursal asignada.'
            ], 403);
        }

        if (!$vendedorAuthId) {
            return response()->json([
                'message' => 'No se encontró vendedor relacionado a este usuario.'
            ], 403);
        }

        $data = $request->validate([
            'cliente_id' => ['required', 'integer', Rule::exists('clientes', 'id')],
            'ruta_id' => ['required', 'integer', Rule::exists('rutas', 'id')],
            'zona_id' => ['required', 'integer', Rule::exists('zonas', 'id')],
            'observaciones' => ['nullable', 'string'],
            'total' => ['required', 'numeric', 'min:0'],
            'detalles' => ['required', 'array', 'min:1'],
            'detalles.*.producto_id' => ['required', 'integer', Rule::exists('productos', 'id')],
            'detalles.*.presentacion' => ['nullable', 'string', 'max:30'],
            'detalles.*.cantidad' => ['nullable', 'numeric', 'min:0.0001'],
            'detalles.*.cantidad_base' => ['required', 'numeric', 'min:0.0001'],
            'detalles.*.precio_unitario' => ['required', 'numeric', 'min:0'],
            'detalles.*.subtotal' => ['required', 'numeric', 'min:0'],
            'detalles.*.es_monto_variable' => ['nullable', 'boolean'],
        ]);

        return DB::transaction(function () use ($data, $ubicacionAuthId, $vendedorAuthId) {
            $vendedor = Vendedor::with('usuario')->findOrFail($vendedorAuthId);
            $cliente = Cliente::findOrFail($data['cliente_id']);

            $asignado = $vendedor->clientes()
                ->where('clientes.id', $cliente->id)
                ->where('vendedor_clientes.activo', 1)
                ->exists();

            if (!$asignado) {
                return response()->json([
                    'message' => 'Este cliente no está asignado al vendedor.'
                ], 422);
            }

            $venta = Venta::create([
                'caja_id' => null,
                'ubicacion_id' => $ubicacionAuthId,
                'usuario_id' => $vendedor->usuario_id,
                'vendedor_id' => $vendedorAuthId,
                'cliente_id' => $data['cliente_id'],
                'rutero_id' => null,
                'ruta_id' => $data['ruta_id'],
                'zona_id' => $data['zona_id'],
                'tipo_venta' => 'pedido_vendedor',
                'total' => $data['total'],
                'efectivo' => 0,
                'cambio' => 0,
                'metodo_pago' => 'pendiente',
                'estado' => 'pendiente_revision',
                'nota' => null,
                'observaciones' => $data['observaciones'] ?? null,
                'fecha_en_ruta' => null,
                'entregado_en' => null,
            ]);

            foreach ($data['detalles'] as $item) {
                VentaDetalle::create([
                    'venta_id' => $venta->id,
                    'producto_id' => $item['producto_id'],
                    'presentacion' => $item['presentacion'] ?? null,
                    'cantidad' => isset($item['cantidad']) ? (float) $item['cantidad'] : null,
                    'cantidad_base' => $item['cantidad_base'],
                    'precio_unitario' => $item['precio_unitario'],
                    'subtotal' => $item['subtotal'],
                    'es_monto_variable' => (int) ($item['es_monto_variable'] ?? 0),
                ]);
            }

            $this->loadVentaRelations($venta);

            return response()->json([
                'message' => 'Pedido creado correctamente.',
                'data' => $this->ventaResponse($venta),
            ], 201);
        });
    }

    public function indexPedidosAdmin(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $ubicacionAuthId = $this->userUbicacionId($user);

        $q = trim((string) $request->query('q', ''));
        $estado = $this->normalizeEstado($request->query('estado', ''));
        $perPage = (int) $request->query('per_page', 20);
        $perPage = max(1, min($perPage, 100));

        $query = Venta::query()
            ->with([
                'cliente:id,nombre',
                'vendedor:id,codigo,usuario_id',
                'vendedor.usuario:id,nombre,usuario',
                'rutero:id,nombre,usuario,rol',
                'ruta:id,nombre',
                'zona:id,nombre',
                'ubicacion:id,nombre,tipo',
                'detalles.producto:id,nombre,sku',
            ])
            ->where('tipo_venta', 'pedido_vendedor');

        if ($role === 'admin') {
            if (!$ubicacionAuthId) {
                return response()->json([
                    'message' => 'El admin no tiene sucursal asignada.'
                ], 403);
            }

            $query->where('ubicacion_id', $ubicacionAuthId);
        }

        if ($estado !== '') {
            $query->where('estado', $estado);
        }

        if ($q !== '') {
            $query->where(function ($w) use ($q) {
                $w->where('id', 'like', "%{$q}%")
                    ->orWhereHas('cliente', function ($c) use ($q) {
                        $c->where('nombre', 'like', "%{$q}%");
                    })
                    ->orWhereHas('vendedor.usuario', function ($u) use ($q) {
                        $u->where('nombre', 'like', "%{$q}%")
                          ->orWhere('usuario', 'like', "%{$q}%");
                    })
                    ->orWhereHas('rutero', function ($r) use ($q) {
                        $r->where('nombre', 'like', "%{$q}%")
                          ->orWhere('usuario', 'like', "%{$q}%");
                    });
            });
        }

        $items = $query
            ->orderByDesc('id')
            ->paginate($perPage)
            ->through(fn ($venta) => $this->ventaResponse($venta));

        return response()->json($items);
    }

    public function aprobarPedidoAdmin(Venta $venta, Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $ubicacionAuthId = $this->userUbicacionId($user);

        if (!in_array($role, ['admin', 'super_admin'], true)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($role === 'admin' && (int) $venta->ubicacion_id !== (int) $ubicacionAuthId) {
            return response()->json(['message' => 'No puedes aprobar pedidos de otra sucursal.'], 403);
        }

        if ($venta->tipo_venta !== 'pedido_vendedor') {
            return response()->json(['message' => 'Venta no válida para este flujo.'], 422);
        }

        $venta->estado = 'aprobado';
        $venta->save();

        $this->loadVentaRelations($venta);

        return response()->json([
            'message' => 'Pedido aprobado.',
            'data' => $this->ventaResponse($venta),
        ]);
    }

    public function prepararPedidoAdmin(Venta $venta, Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $ubicacionAuthId = $this->userUbicacionId($user);

        if (!in_array($role, ['admin', 'super_admin'], true)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($role === 'admin' && (int) $venta->ubicacion_id !== (int) $ubicacionAuthId) {
            return response()->json(['message' => 'No puedes preparar pedidos de otra sucursal.'], 403);
        }

        if ($venta->tipo_venta !== 'pedido_vendedor') {
            return response()->json(['message' => 'Venta no válida para este flujo.'], 422);
        }

        $venta->estado = 'preparando';
        $venta->save();

        $this->loadVentaRelations($venta);

        return response()->json([
            'message' => 'Pedido en preparación.',
            'data' => $this->ventaResponse($venta),
        ]);
    }

    public function entregarPedidoAdmin(Venta $venta, Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $ubicacionAuthId = $this->userUbicacionId($user);

        if (!in_array($role, ['admin', 'super_admin', 'rutero'], true)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($role === 'admin' && (int) $venta->ubicacion_id !== (int) $ubicacionAuthId) {
            return response()->json(['message' => 'No puedes entregar pedidos de otra sucursal.'], 403);
        }

        if ($role === 'rutero' && (int) $venta->rutero_id !== (int) $user->id) {
            return response()->json([
                'message' => 'No puedes entregar un pedido que no te fue asignado.'
            ], 403);
        }

        if ($venta->tipo_venta !== 'pedido_vendedor') {
            return response()->json(['message' => 'Venta no válida para este flujo.'], 422);
        }

        if (!in_array($venta->estado, ['preparando', 'aprobado', 'en_ruta'], true)) {
            return response()->json([
                'message' => 'Solo se puede entregar un pedido preparado.'
            ], 422);
        }

        $data = $request->validate([
            'metodo_pago' => ['required', 'in:efectivo,tarjeta,cuotas'],
            'nombre_pagador' => ['nullable', 'string', 'max:255'],
            'referencia_pago' => ['nullable', 'string', 'max:255'],
            'observacion_entrega' => ['nullable', 'string', 'max:1000'],
            'cliente_id' => ['nullable', 'integer'],
        ]);

        return DB::transaction(function () use ($venta, $user, $data) {
            $metodoPago = $data['metodo_pago'];
            $ubicacionId = (int) $venta->ubicacion_id;

            if ($metodoPago === 'cuotas' && empty($data['cliente_id']) && empty($venta->cliente_id)) {
                return response()->json([
                    'message' => 'Para entregar a crédito debes seleccionar un cliente.'
                ], 422);
            }

            $venta->metodo_pago = $metodoPago;

            if ($metodoPago === 'cuotas') {
                $venta->cliente_id = !empty($data['cliente_id'])
                    ? (int) $data['cliente_id']
                    : $venta->cliente_id;
            }

            if (!empty($data['observacion_entrega'])) {
                $obsActual = trim((string) ($venta->observaciones ?? ''));
                $obsNueva = trim((string) $data['observacion_entrega']);

                $venta->observaciones = $obsActual !== ''
                    ? $obsActual . "\n" . $obsNueva
                    : $obsNueva;
            }

            $venta->estado = 'entregado';
            $venta->entregado_en = now();
            $venta->save();

            if (in_array($metodoPago, ['efectivo', 'tarjeta'], true)) {
                $caja = Caja::query()
                    ->where('ubicacion_id', $ubicacionId)
                    ->whereNull('cerrado_en')
                    ->latest('id')
                    ->first();

                if (!$caja) {
                    return response()->json([
                        'message' => 'No hay una caja abierta en esta sucursal para registrar el cobro.'
                    ], 422);
                }

                MovimientoCaja::create([
                    'caja_id' => (int) $caja->id,
                    'ubicacion_id' => $ubicacionId,
                    'usuario_id' => (int) $user->id,
                    'tipo' => 'ingreso',
                    'concepto' => 'venta_rutero',
                    'monto' => round((float) $venta->total, 2),
                    'metodo_pago' => $metodoPago,
                    'referencia_id' => (int) $venta->id,
                    'referencia_tipo' => 'venta',
                    'notas' => 'Cobro de pedido entregado por rutero'
                        . (!empty($data['nombre_pagador']) ? ' | Pagador: ' . $data['nombre_pagador'] : '')
                        . (!empty($data['referencia_pago']) ? ' | Ref: ' . $data['referencia_pago'] : ''),
                ]);
            }

            $this->loadVentaRelations($venta);

            return response()->json([
                'message' => $metodoPago === 'cuotas'
                    ? 'Pedido entregado a crédito correctamente.'
                    : 'Pedido entregado y cobrado correctamente.',
                'data' => $this->ventaResponse($venta),
            ]);
        });
    }

    public function actualizarPedidoAdmin(Request $request, Venta $venta)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $ubicacionAuthId = $this->userUbicacionId($user);

        if (!in_array($role, ['admin', 'super_admin'], true)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($role === 'admin' && (int) $venta->ubicacion_id !== (int) $ubicacionAuthId) {
            return response()->json(['message' => 'No puedes actualizar pedidos de otra sucursal.'], 403);
        }

        if ($venta->tipo_venta !== 'pedido_vendedor') {
            return response()->json(['message' => 'Venta no válida para este flujo.'], 422);
        }

        $data = $request->validate([
            'observaciones' => ['nullable', 'string'],
            'detalles' => ['required', 'array', 'min:1'],
            'detalles.*.id' => ['required', 'integer', Rule::exists('venta_detalles', 'id')],
            'detalles.*.presentacion' => ['nullable', 'string', 'max:30'],
            'detalles.*.cantidad' => ['nullable', 'numeric', 'min:0.0001'],
            'detalles.*.cantidad_base' => ['required', 'numeric', 'min:0.0001'],
            'detalles.*.precio_unitario' => ['required', 'numeric', 'min:0'],
            'detalles.*.subtotal' => ['required', 'numeric', 'min:0'],
            'detalles.*.es_monto_variable' => ['nullable', 'boolean'],
        ]);

        return DB::transaction(function () use ($venta, $data) {
            $total = 0;

            foreach ($data['detalles'] as $item) {
                $detalle = VentaDetalle::query()
                    ->where('venta_id', $venta->id)
                    ->where('id', $item['id'])
                    ->first();

                if (!$detalle) {
                    return response()->json([
                        'message' => "Detalle {$item['id']} no pertenece a este pedido."
                    ], 422);
                }

                $detalle->update([
                    'presentacion' => $item['presentacion'] ?? null,
                    'cantidad' => isset($item['cantidad']) ? (float) $item['cantidad'] : null,
                    'cantidad_base' => $item['cantidad_base'],
                    'precio_unitario' => $item['precio_unitario'],
                    'subtotal' => $item['subtotal'],
                    'es_monto_variable' => (int) ($item['es_monto_variable'] ?? 0),
                ]);

                $total += (float) $item['subtotal'];
            }

            $venta->update([
                'observaciones' => $data['observaciones'] ?? $venta['observaciones'],
                'total' => $total,
            ]);

            $this->loadVentaRelations($venta);

            return response()->json([
                'message' => 'Pedido actualizado correctamente.',
                'data' => $this->ventaResponse($venta),
            ]);
        });
    }

    public function indexPedidosVendedor(Request $request)
    {
        $user = $request->user();
        $vendedorAuthId = $this->resolveVendedorId($user);
        $ubicacionAuthId = $this->userUbicacionId($user);
        $estado = $this->normalizeEstado($request->query('estado', ''));
        $perPage = (int) $request->query('per_page', 20);
        $perPage = max(1, min($perPage, 100));

        if (!$vendedorAuthId) {
            return response()->json([
                'message' => 'No se encontró vendedor relacionado a este usuario.'
            ], 422);
        }

        $query = Venta::query()
            ->with([
                'cliente:id,nombre',
                'vendedor:id,codigo,usuario_id',
                'vendedor.usuario:id,nombre,usuario',
                'rutero:id,nombre,usuario,rol',
                'ruta:id,nombre',
                'zona:id,nombre',
                'ubicacion:id,nombre,tipo',
                'detalles.producto:id,nombre,sku',
            ])
            ->where('tipo_venta', 'pedido_vendedor')
            ->where('vendedor_id', $vendedorAuthId);

        if ($ubicacionAuthId) {
            $query->where('ubicacion_id', $ubicacionAuthId);
        }

        if ($estado !== '') {
            $query->where('estado', $estado);
        }

        $items = $query
            ->orderByDesc('id')
            ->paginate($perPage)
            ->through(fn ($venta) => $this->ventaResponse($venta));

        return response()->json($items);
    }

    public function asignarRutero(Request $request, Venta $venta)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $ubicacionAuthId = $this->userUbicacionId($user);

        if (!in_array($role, ['admin', 'super_admin'], true)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($role === 'admin' && (int) $venta->ubicacion_id !== (int) $ubicacionAuthId) {
            return response()->json(['message' => 'No puedes modificar pedidos de otra sucursal.'], 403);
        }

        $data = $request->validate([
            'rutero_id' => [
                'required',
                'integer',
                Rule::exists('usuarios', 'id')->where(function ($q) {
                    $q->where('rol', 'rutero');
                }),
            ],
        ]);

        $venta->rutero_id = $data['rutero_id'];
        $venta->estado = 'en_ruta';
        $venta->fecha_en_ruta = now();
        $venta->save();

        $this->loadVentaRelations($venta);

        return response()->json([
            'message' => 'Rutero asignado correctamente.',
            'pedido' => $this->ventaResponse($venta),
        ]);
    }
}