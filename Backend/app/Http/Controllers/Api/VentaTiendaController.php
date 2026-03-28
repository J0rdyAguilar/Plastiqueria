<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VentaTienda;
use App\Models\VentaTiendaDetalle;
use App\Models\Stock;
use App\Models\MovimientoStock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class VentaTiendaController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = VentaTienda::with([
            'detalles.producto',
            'cliente',
            'usuario',
            'ubicacion',
        ]);

        if ($user->rol !== 'super_admin') {
            $query->where('ubicacion_id', $user->ubicacion_id);
        }

        return response()->json(
            $query->orderByDesc('id')
                ->limit(50)
                ->get()
        );
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'cliente_id'             => ['nullable', 'integer'],
            'metodo_pago'            => ['nullable', 'string', 'max:30'],
            'descuento'              => ['nullable', 'numeric', 'min:0'],
            'items'                  => ['required', 'array', 'min:1'],
            'items.*.producto_id'    => ['required', 'integer'],
            'items.*.cantidad'       => ['required', 'numeric', 'min:0.0001'],
            'items.*.precio_unitario'=> ['required', 'numeric', 'min:0'],
        ]);

        $ubicacionId = $user->ubicacion_id;
        $descuento = (float) ($request->descuento ?? 0);

        $venta = DB::transaction(function () use ($request, $user, $ubicacionId, $descuento) {
            $subtotalGeneral = 0;

            foreach ($request->items as $item) {
                $cantidad = (float) $item['cantidad'];
                $precioUnitario = (float) $item['precio_unitario'];
                $subtotalGeneral += $cantidad * $precioUnitario;
            }

            $totalGeneral = max($subtotalGeneral - $descuento, 0);

            $venta = VentaTienda::create([
                'ubicacion_id' => $ubicacionId,
                'usuario_id'   => $user->id,
                'cliente_id'   => $request->cliente_id,
                'estado'       => 'confirmada',
                'metodo_pago'  => $request->metodo_pago,
                'subtotal'     => $subtotalGeneral,
                'descuento'    => $descuento,
                'total'        => $totalGeneral,
            ]);

            foreach ($request->items as $item) {
                $productoId = (int) $item['producto_id'];
                $cantidad = (float) $item['cantidad'];
                $precioUnitario = (float) $item['precio_unitario'];
                $subtotal = $cantidad * $precioUnitario;

                $stock = Stock::where('ubicacion_id', $ubicacionId)
                    ->where('producto_id', $productoId)
                    ->lockForUpdate()
                    ->first();

                if (!$stock) {
                    throw ValidationException::withMessages([
                        'stock' => ["No existe stock para el producto {$productoId} en esta sucursal."],
                    ]);
                }

                if ((float) $stock->cantidad_base < $cantidad) {
                    throw ValidationException::withMessages([
                        'stock' => ["Stock insuficiente para el producto {$productoId}."],
                    ]);
                }

                VentaTiendaDetalle::create([
                    'venta_id'        => $venta->id,
                    'producto_id'     => $productoId,
                    'cantidad'        => $cantidad,
                    'precio_unitario' => $precioUnitario,
                    'subtotal'        => $subtotal,
                ]);

                $stock->cantidad_base = (float) $stock->cantidad_base - $cantidad;
                $stock->save();

                MovimientoStock::create([
                    'ubicacion_id' => $ubicacionId,
                    'producto_id'  => $productoId,
                    'tipo'         => 'salida',
                    'motivo'       => 'venta_tienda',
                    'cantidad'     => $cantidad,
                    'usuario_id'   => $user->id,
                ]);
            }

            return $venta->load([
                'detalles.producto',
                'cliente',
                'usuario',
                'ubicacion',
            ]);
        });

        return response()->json([
            'ok'      => true,
            'message' => 'Venta realizada correctamente.',
            'data'    => $venta,
        ], 201);
    }
}