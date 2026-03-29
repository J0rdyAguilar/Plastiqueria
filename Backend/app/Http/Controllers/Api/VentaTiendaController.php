<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VentaTienda;
use App\Models\VentaTiendaDetalle;
use App\Models\Stock;
use App\Models\MovimientoStock;
use App\Models\Caja;
use App\Models\MovimientoCaja;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class VentaTiendaController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $q = trim((string) $request->query('q', ''));
        $estado = trim((string) $request->query('estado', ''));
        $metodoPago = trim((string) $request->query('metodo_pago', ''));
        $fechaDesde = $request->query('fecha_desde');
        $fechaHasta = $request->query('fecha_hasta');
        $soloMias = (int) $request->query('solo_mias', 0);
        $perPage = max(1, min((int) $request->query('per_page', 20), 100));

        $query = VentaTienda::with([
            'detalles.producto',
            'cliente',
            'usuario',
            'ubicacion',
        ])->orderByDesc('id');

        $role = strtolower((string) ($user->rol ?? $user->role ?? ''));
        $role = str_replace(['-', ' '], '_', $role);

        if ($role !== 'super_admin' && $role !== 'superadmin') {
            $query->where('ubicacion_id', $user->ubicacion_id);
        }

        if ($role === 'vendedor_tienda' || $soloMias === 1) {
            $query->where('usuario_id', $user->id);
        }

        if ($estado !== '') {
            $query->where('estado', $estado);
        }

        if ($metodoPago !== '') {
            $query->where('metodo_pago', $metodoPago);
        }

        if (!empty($fechaDesde)) {
            $query->whereDate('creado_en', '>=', $fechaDesde);
        }

        if (!empty($fechaHasta)) {
            $query->whereDate('creado_en', '<=', $fechaHasta);
        }

        if ($q !== '') {
            $query->where(function ($sub) use ($q) {
                $sub->where('id', 'like', "%{$q}%")
                    ->orWhere('estado', 'like', "%{$q}%")
                    ->orWhere('metodo_pago', 'like', "%{$q}%")
                    ->orWhereHas('cliente', function ($c) use ($q) {
                        $c->where('nombre', 'like', "%{$q}%")
                          ->orWhere('nit', 'like', "%{$q}%");
                    })
                    ->orWhereHas('usuario', function ($u) use ($q) {
                        $u->where('nombre', 'like', "%{$q}%")
                          ->orWhere('usuario', 'like', "%{$q}%");
                    })
                    ->orWhereHas('ubicacion', function ($u) use ($q) {
                        $u->where('nombre', 'like', "%{$q}%");
                    })
                    ->orWhereHas('detalles.producto', function ($p) use ($q) {
                        $p->where('nombre', 'like', "%{$q}%")
                          ->orWhere('codigo', 'like', "%{$q}%")
                          ->orWhere('id', 'like', "%{$q}%");
                    });
            });
        }

        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'cliente_id'               => ['nullable', 'integer'],
            'metodo_pago'              => ['required', 'string', 'in:efectivo,tarjeta'],
            'descuento'                => ['nullable', 'numeric', 'min:0'],
            'items'                    => ['required', 'array', 'min:1'],
            'items.*.producto_id'      => ['required', 'string', 'max:50'],
            'items.*.cantidad'         => ['required', 'numeric', 'min:0.0001'],
            'items.*.precio_unitario'  => ['required', 'numeric', 'min:0'],
        ]);

        $ubicacionId = (int) ($user->ubicacion_id ?? 0);

        if (!$ubicacionId) {
            throw ValidationException::withMessages([
                'ubicacion' => ['El usuario no tiene sucursal asignada.'],
            ]);
        }

        $metodoPago = trim((string) $request->metodo_pago);
        $descuento = (float) ($request->descuento ?? 0);

        $venta = DB::transaction(function () use ($request, $user, $ubicacionId, $descuento, $metodoPago) {
            $caja = Caja::query()
                ->where('ubicacion_id', $ubicacionId)
                ->whereNull('cerrado_en')
                ->latest('id')
                ->lockForUpdate()
                ->first();

            if (!$caja) {
                throw ValidationException::withMessages([
                    'caja' => ['No hay una caja abierta en esta sucursal.'],
                ]);
            }

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
                'metodo_pago'  => $metodoPago,
                'subtotal'     => $subtotalGeneral,
                'descuento'    => $descuento,
                'total'        => $totalGeneral,
            ]);

            foreach ($request->items as $item) {
                $productoId = (string) $item['producto_id'];
                $cantidad = (float) $item['cantidad'];
                $precioUnitario = (float) $item['precio_unitario'];
                $subtotal = $cantidad * $precioUnitario;

                $stock = Stock::query()
                    ->where('ubicacion_id', $ubicacionId)
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
                    'tipo'                 => 'salida',
                    'ubicacion_origen_id'  => $ubicacionId,
                    'ubicacion_destino_id' => null,
                    'producto_id'          => $productoId,
                    'producto_precio_id'   => $stock->producto_precio_id ?? null,
                    'presentacion'         => null,
                    'factor_aplicado'      => 1,
                    'cantidad'             => $cantidad,
                    'cantidad_base'        => $cantidad,
                    'motivo'               => 'venta_tienda',
                    'referencia_tipo'      => 'venta_tienda',
                    'referencia_id'        => $venta->id,
                    'creado_por'           => $user->id,
                    'creado_en'            => now(),
                ]);
            }

            MovimientoCaja::create([
                'caja_id'         => $caja->id,
                'ubicacion_id'    => $ubicacionId,
                'usuario_id'      => $user->id,
                'tipo'            => 'ingreso',
                'concepto'        => 'venta_tienda',
                'monto'           => $totalGeneral,
                'metodo_pago'     => $metodoPago,
                'referencia_id'   => $venta->id,
                'referencia_tipo' => 'venta_tienda',
                'notas'           => 'Venta registrada desde módulo de tienda',
            ]);

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