<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\Stock;
use App\Models\Venta;
use App\Models\VentaDetalle;
use App\Models\Vendedor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class VentaController extends Controller
{
    public function storePedidoVendedor(Request $request)
    {
        $data = $request->validate([
            'ubicacion_id' => ['required', 'integer', Rule::exists('ubicaciones', 'id')],
            'vendedor_id' => ['required', 'integer', Rule::exists('vendedores', 'id')],
            'cliente_id' => ['required', 'integer', Rule::exists('clientes', 'id')],
            'ruta_id' => ['required', 'integer', Rule::exists('rutas', 'id')],
            'zona_id' => ['required', 'integer', Rule::exists('zonas', 'id')],
            'observaciones' => ['nullable', 'string'],
            'total' => ['required', 'numeric', 'min:0'],
            'detalles' => ['required', 'array', 'min:1'],
            'detalles.*.producto_id' => ['required', 'integer', Rule::exists('productos', 'id')],
            'detalles.*.presentacion' => ['nullable', 'string', 'max:30'],
            'detalles.*.cantidad_base' => ['required', 'numeric', 'min:0.0001'],
            'detalles.*.precio_unitario' => ['required', 'numeric', 'min:0'],
            'detalles.*.subtotal' => ['required', 'numeric', 'min:0'],
            'detalles.*.es_monto_variable' => ['nullable', 'boolean'],
        ]);

        return DB::transaction(function () use ($data) {
            $vendedor = Vendedor::findOrFail($data['vendedor_id']);
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

            foreach ($data['detalles'] as $item) {
                $stock = Stock::query()
                    ->where('ubicacion_id', $data['ubicacion_id'])
                    ->where('producto_id', $item['producto_id'])
                    ->lockForUpdate()
                    ->first();

                if (!$stock) {
                    return response()->json([
                        'message' => "No existe stock para el producto {$item['producto_id']} en esa sucursal."
                    ], 422);
                }

                if ((float) $stock->cantidad_base < (float) $item['cantidad_base']) {
                    return response()->json([
                        'message' => "Stock insuficiente para el producto {$item['producto_id']}."
                    ], 422);
                }
            }

            $venta = Venta::create([
                'caja_id' => null,
                'ubicacion_id' => $data['ubicacion_id'],
                'usuario_id' => $vendedor->usuario_id,
                'vendedor_id' => $data['vendedor_id'],
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
                    'cantidad_base' => $item['cantidad_base'],
                    'precio_unitario' => $item['precio_unitario'],
                    'subtotal' => $item['subtotal'],
                    'es_monto_variable' => (int) ($item['es_monto_variable'] ?? 0),
                ]);

                $stock = Stock::query()
                    ->where('ubicacion_id', $data['ubicacion_id'])
                    ->where('producto_id', $item['producto_id'])
                    ->lockForUpdate()
                    ->first();

                $stock->cantidad_base = (float) $stock->cantidad_base - (float) $item['cantidad_base'];
                $stock->save();
            }

            return response()->json([
                'message' => 'Pedido creado correctamente.',
                'data' => $venta,
            ], 201);
        });
    }

    public function indexPedidosAdmin(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $estado = trim((string) $request->query('estado', ''));
        $perPage = (int) $request->query('per_page', 20);
        $perPage = max(1, min($perPage, 100));

        $query = Venta::query()
            ->with([
                'cliente:id,nombre',
                'vendedor.usuario:id,nombre,usuario',
                'detalles.producto:id,nombre,sku',
            ])
            ->where('tipo_venta', 'pedido_vendedor');

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
            ->through(function ($venta) {
                return [
                    'id' => $venta->id,
                    'cliente_nombre' => $venta->cliente?->nombre,
                    'vendedor_nombre' => $venta->vendedor?->usuario?->nombre
                        ?? $venta->vendedor?->usuario?->usuario,
                    'estado' => $venta->estado,
                    'total' => $venta->total,
                    'observaciones' => $venta->observaciones,
                    'creado_en' => optional($venta->creado_en)?->format('Y-m-d H:i:s'),
                    'detalles' => $venta->detalles->map(function ($d) {
                        return [
                            'id' => $d->id,
                            'producto_id' => $d->producto_id,
                            'producto_nombre' => $d->producto?->nombre,
                            'presentacion' => $d->presentacion,
                            'cantidad_base' => $d->cantidad_base,
                            'precio_unitario' => $d->precio_unitario,
                            'subtotal' => $d->subtotal,
                        ];
                    })->values(),
                ];
            });

        return response()->json($items);
    }

    public function aprobarPedidoAdmin(Venta $venta)
    {
        if ($venta->tipo_venta !== 'pedido_vendedor') {
            return response()->json([
                'message' => 'Venta no válida para este flujo.'
            ], 422);
        }

        $venta->estado = 'aprobado';
        $venta->save();

        return response()->json([
            'message' => 'Pedido aprobado.',
            'data' => $venta,
        ]);
    }

    public function prepararPedidoAdmin(Venta $venta)
    {
        if ($venta->tipo_venta !== 'pedido_vendedor') {
            return response()->json([
                'message' => 'Venta no válida para este flujo.'
            ], 422);
        }

        $venta->estado = 'preparando';
        $venta->save();

        return response()->json([
            'message' => 'Pedido en preparación.',
            'data' => $venta,
        ]);
    }

    public function entregarPedidoAdmin(Venta $venta)
    {
        if ($venta->tipo_venta !== 'pedido_vendedor') {
            return response()->json([
                'message' => 'Venta no válida para este flujo.'
            ], 422);
        }

        $venta->estado = 'entregado';
        $venta->save();

        return response()->json([
            'message' => 'Pedido entregado.',
            'data' => $venta,
        ]);
    }
public function actualizarPedidoAdmin(Request $request, Venta $venta)
{
    if ($venta->tipo_venta !== 'pedido_vendedor') {
        return response()->json([
            'message' => 'Venta no válida para este flujo.'
        ], 422);
    }

    $data = $request->validate([
        'observaciones' => ['nullable', 'string'],
        'detalles' => ['required', 'array', 'min:1'],
        'detalles.*.id' => ['required', 'integer', Rule::exists('venta_detalles', 'id')],
        'detalles.*.presentacion' => ['nullable', 'string', 'max:30'],
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
            'data' => $venta->fresh(['detalles.producto', 'cliente', 'vendedor.usuario']),
        ]);
    });
}
public function indexPedidosVendedor(Request $request)
{
    $vendedorId = (int) $request->query('vendedor_id');
    $estado = trim((string) $request->query('estado', ''));
    $perPage = (int) $request->query('per_page', 20);
    $perPage = max(1, min($perPage, 100));

    if (!$vendedorId) {
        return response()->json([
            'message' => 'vendedor_id es requerido.'
        ], 422);
    }

    $query = Venta::query()
        ->with([
            'cliente:id,nombre',
            'detalles.producto:id,nombre,sku',
        ])
        ->where('tipo_venta', 'pedido_vendedor')
        ->where('vendedor_id', $vendedorId);

    if ($estado !== '') {
        $query->where('estado', $estado);
    }

    $items = $query
        ->orderByDesc('id')
        ->paginate($perPage)
        ->through(function ($venta) {
            return [
                'id' => $venta->id,
                'cliente_nombre' => $venta->cliente?->nombre,
                'estado' => $venta->estado,
                'total' => $venta->total,
                'observaciones' => $venta->observaciones,
                'creado_en' => optional($venta->creado_en)?->format('Y-m-d H:i:s'),
                'detalles' => $venta->detalles->map(function ($d) {
                    return [
                        'id' => $d->id,
                        'producto_id' => $d->producto_id,
                        'producto_nombre' => $d->producto?->nombre,
                        'presentacion' => $d->presentacion,
                        'cantidad_base' => $d->cantidad_base,
                        'precio_unitario' => $d->precio_unitario,
                        'subtotal' => $d->subtotal,
                    ];
                })->values(),
            ];
        });

    return response()->json($items);
}
    }
