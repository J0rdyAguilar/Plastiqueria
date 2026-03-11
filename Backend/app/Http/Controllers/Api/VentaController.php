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

        return DB::transaction(function () use ($data, $request) {
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
                'usuario_id' => $request->user()?->id,
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
}