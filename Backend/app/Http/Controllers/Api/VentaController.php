<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
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

    private function ventaResponse(Venta $venta): array
    {
        return [
            'id' => $venta->id,
            'cliente_id' => $venta->cliente_id,
            'cliente_nombre' => $venta->cliente?->nombre,
            'vendedor_id' => $venta->vendedor_id,
            'vendedor_nombre' => $venta->vendedor?->usuario?->nombre
                ?? $venta->vendedor?->usuario?->usuario
                ?? $venta->vendedor?->codigo
                ?? ('Vendedor #' . $venta->vendedor_id),
            'ubicacion_id' => $venta->ubicacion_id,
            'ruta_id' => $venta->ruta_id,
            'zona_id' => $venta->zona_id,
            'estado' => $venta->estado,
            'total' => (float) $venta->total,
            'observaciones' => $venta->observaciones,
            'creado_en' => optional($venta->creado_en)?->format('Y-m-d H:i:s'),
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

            $venta->load([
                'cliente:id,nombre',
                'vendedor.usuario:id,nombre,usuario',
                'detalles.producto:id,nombre,sku',
            ]);

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
                'vendedor.usuario:id,nombre,usuario',
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

        return response()->json([
            'message' => 'Pedido aprobado.',
            'data' => $this->ventaResponse($venta->fresh(['cliente', 'vendedor.usuario', 'detalles.producto'])),
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

        return response()->json([
            'message' => 'Pedido en preparación.',
            'data' => $this->ventaResponse($venta->fresh(['cliente', 'vendedor.usuario', 'detalles.producto'])),
        ]);
    }

    public function entregarPedidoAdmin(Venta $venta, Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $ubicacionAuthId = $this->userUbicacionId($user);

        if (!in_array($role, ['admin', 'super_admin'], true)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($role === 'admin' && (int) $venta->ubicacion_id !== (int) $ubicacionAuthId) {
            return response()->json(['message' => 'No puedes entregar pedidos de otra sucursal.'], 403);
        }

        if ($venta->tipo_venta !== 'pedido_vendedor') {
            return response()->json(['message' => 'Venta no válida para este flujo.'], 422);
        }

        $venta->estado = 'entregado';
        $venta->save();

        return response()->json([
            'message' => 'Pedido entregado.',
            'data' => $this->ventaResponse($venta->fresh(['cliente', 'vendedor.usuario', 'detalles.producto'])),
        ]);
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
                'observaciones' => $data['observaciones'] ?? $venta->observaciones,
                'total' => $total,
            ]);

            return response()->json([
                'message' => 'Pedido actualizado correctamente.',
                'data' => $this->ventaResponse(
                    $venta->fresh(['detalles.producto', 'cliente', 'vendedor.usuario'])
                ),
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
                'detalles.producto:id,nombre,sku',
                'vendedor.usuario:id,nombre,usuario',
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
}