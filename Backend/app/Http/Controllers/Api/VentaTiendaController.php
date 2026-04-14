<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VentaTienda;
use App\Models\VentaTiendaDetalle;
use App\Models\Stock;
use App\Models\MovimientoStock;
use App\Models\Ubicacion;
use App\Models\ProductoPrecio;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class VentaTiendaController extends Controller
{
    private function roleOf($user): string
    {
        $r = strtolower(trim((string) ($user->rol ?? $user->role ?? '')));

        if ($r === 'superadmin' || $r === 'super_admin') return 'super_admin';
        if (in_array($r, ['vendedor-tienda', 'vendedor_tienda', 'vendedor tienda'], true)) {
            return 'vendedor-tienda';
        }
        if ($r === 'admin') return 'admin';

        return $r;
    }

    private function userUbicacionId($user): ?int
    {
        $id = $user->ubicacion_id ?? $user->sucursal_id ?? null;
        return $id !== null ? (int) $id : null;
    }

    private function buildVentaResponse($venta, $movimientosByVenta = null, $preciosById = null): array
    {
        $movs = collect();

        if ($movimientosByVenta !== null) {
            $movs = collect($movimientosByVenta->get($venta->id, []));
        } else {
            $movs = MovimientoStock::query()
                ->where('referencia_tipo', 'venta_tienda')
                ->where('referencia_id', (int) $venta->id)
                ->get();
        }

        $detalles = $venta->detalles->map(function ($d) use ($movs, $preciosById) {
            $mov = $movs->first(function ($m) use ($d) {
                return (int) $m->producto_id === (int) $d->producto_id;
            });

            $productoPrecio = null;

            if ($mov && !empty($mov->producto_precio_id)) {
                if ($preciosById !== null) {
                    $productoPrecio = $preciosById->get((int) $mov->producto_precio_id);
                } else {
                    $productoPrecio = ProductoPrecio::query()->find((int) $mov->producto_precio_id);
                }
            }

            $precioCosto = (float) ($productoPrecio?->precio_costo ?? 0);
            $precioVentaCatalogo = (float) ($productoPrecio?->precio_venta ?? 0);
            $precioUnitario = (float) ($d->precio_unitario ?? 0);
            $cantidad = (float) ($d->cantidad ?? 0);
            $subtotal = (float) ($d->subtotal ?? ($cantidad * $precioUnitario));
            $gananciaUnitaria = $precioUnitario - $precioCosto;
            $gananciaTotal = $gananciaUnitaria * $cantidad;

            return [
                'id' => $d->id,
                'producto_id' => (int) $d->producto_id,
                'producto_nombre' => $d->producto?->nombre ?? null,
                'producto_precio_id' => $mov ? (int) ($mov->producto_precio_id ?? 0) : null,
                'presentacion' => $mov?->presentacion ?? null,
                'cantidad' => $cantidad,
                'precio_costo' => $precioCosto,
                'precio_unitario' => $precioUnitario,
                'precio_venta_catalogo' => $precioVentaCatalogo,
                'subtotal' => $subtotal,
                'ganancia_unitaria' => $gananciaUnitaria,
                'ganancia_total' => $gananciaTotal,
            ];
        })->values();

        return [
            'id' => $venta->id,
            'estado' => $venta->estado,
            'metodo_pago' => $venta->metodo_pago,
            'subtotal' => (float) $venta->subtotal,
            'descuento' => (float) $venta->descuento,
            'total' => (float) $venta->total,
            'ganancia_total' => (float) $detalles->sum('ganancia_total'),
            'creado_en' => optional($venta->creado_en)->format('Y-m-d H:i:s'),

            'usuario' => $venta->usuario,
            'usuario_nombre' => $venta->usuario?->nombre ?? $venta->usuario?->usuario,

            'ubicacion' => $venta->ubicacion,
            'ubicacion_nombre' => $venta->ubicacion?->nombre,

            'cliente' => $venta->cliente,
            'nombre_comprador' => null,

            'detalles' => $detalles,
        ];
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $userUbicacionId = $this->userUbicacionId($user);

        $query = VentaTienda::query()
            ->with([
                'detalles.producto:id,nombre',
                'usuario:id,nombre,usuario',
                'ubicacion:id,nombre',
                'cliente:id,nombre',
            ])
            ->orderByDesc('creado_en')
            ->orderByDesc('id');

        if ($role === 'super_admin') {
            if ($request->filled('ubicacion_id')) {
                $query->where('ubicacion_id', (int) $request->ubicacion_id);
            }
        } elseif (in_array($role, ['admin', 'vendedor-tienda'], true)) {
            if (!$userUbicacionId) {
                return response()->json([
                    'message' => 'El usuario no tiene una sucursal asignada.'
                ], 422);
            }

            $query->where('ubicacion_id', $userUbicacionId);
        } else {
            return response()->json([
                'message' => 'No autorizado.'
            ], 403);
        }

        if ($role === 'vendedor-tienda' && (int) $request->query('solo_mias', 0) === 1) {
            $query->where('usuario_id', (int) $user->id);
        }

        if ($request->filled('metodo_pago')) {
            $query->where('metodo_pago', $request->metodo_pago);
        }

        if ($request->filled('fecha_desde')) {
            $desde = Carbon::parse($request->fecha_desde)->startOfDay();
            $query->where('creado_en', '>=', $desde);
        }

        if ($request->filled('fecha_hasta')) {
            $hasta = Carbon::parse($request->fecha_hasta)->endOfDay();
            $query->where('creado_en', '<=', $hasta);
        }

        $perPage = max(1, (int) $request->query('per_page', 20));
        $page = $query->paginate($perPage);

        $ventas = collect($page->items());
        $ventaIds = $ventas->pluck('id')->map(fn($v) => (int) $v)->values();

        $movimientos = MovimientoStock::query()
            ->where('referencia_tipo', 'venta_tienda')
            ->whereIn('referencia_id', $ventaIds)
            ->get()
            ->groupBy('referencia_id');

        $productoPrecioIds = $movimientos
            ->flatten(1)
            ->pluck('producto_precio_id')
            ->filter()
            ->map(fn($v) => (int) $v)
            ->unique()
            ->values();

        $preciosById = ProductoPrecio::query()
            ->whereIn('id', $productoPrecioIds)
            ->get()
            ->keyBy('id');

        if ($role === 'super_admin') {
            $sucursales = Ubicacion::query()
                ->select('id', 'nombre')
                ->whereIn('nombre', ['Tienda 1', 'Tienda 2'])
                ->orderBy('nombre')
                ->get();
        } else {
            $sucursales = Ubicacion::query()
                ->select('id', 'nombre')
                ->where('id', $userUbicacionId)
                ->get();
        }

        return response()->json([
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'sucursales' => $sucursales,
            'data' => $ventas->map(function ($venta) use ($movimientos, $preciosById) {
                return $this->buildVentaResponse($venta, $movimientos, $preciosById);
            })->values(),
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $userUbicacionId = $this->userUbicacionId($user);

        if (!in_array($role, ['admin', 'super_admin', 'vendedor-tienda'], true)) {
            return response()->json([
                'message' => 'No autorizado.'
            ], 403);
        }

        $data = $request->validate([
            'ubicacion_id' => ['nullable', 'integer', 'exists:ubicaciones,id'],
            'metodo_pago' => ['required', 'string', 'in:efectivo,tarjeta'],
            'nombre_comprador' => ['nullable', 'string', 'max:150'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.producto_id' => ['required', 'integer', 'exists:productos,id'],
            'items.*.producto_precio_id' => ['required', 'integer', 'exists:producto_precios,id'],
            'items.*.presentacion' => ['nullable', 'string', 'max:100'],
            'items.*.cantidad' => ['required', 'numeric', 'min:0.01'],
            'items.*.precio_unitario' => ['required', 'numeric', 'min:0.01'],
        ]);

        if ($role === 'super_admin') {
            $ventaUbicacionId = !empty($data['ubicacion_id'])
                ? (int) $data['ubicacion_id']
                : $userUbicacionId;
        } else {
            $ventaUbicacionId = $userUbicacionId;
        }

        if (!$ventaUbicacionId) {
            return response()->json([
                'message' => 'No se encontró una sucursal válida para la venta.'
            ], 422);
        }

        return DB::transaction(function () use ($data, $user, $ventaUbicacionId) {
            $subtotal = 0;

            foreach ($data['items'] as $item) {
                $productoId = (int) $item['producto_id'];
                $productoPrecioId = (int) $item['producto_precio_id'];
                $cantidad = (float) $item['cantidad'];

                $stock = Stock::query()
                    ->where('ubicacion_id', $ventaUbicacionId)
                    ->where('producto_id', $productoId)
                    ->where('producto_precio_id', $productoPrecioId)
                    ->lockForUpdate()
                    ->first();

                if (!$stock) {
                    return response()->json([
                        'message' => "No existe stock para esa presentación del producto {$productoId} en esta sucursal."
                    ], 422);
                }

                $disponible = (float) ($stock->cantidad ?? 0);

                if ($disponible < $cantidad) {
                    return response()->json([
                        'message' => "Stock insuficiente para el producto {$productoId}. Disponible: {$disponible}"
                    ], 422);
                }

                $subtotal += ((float) $item['precio_unitario']) * $cantidad;
            }

            $venta = VentaTienda::create([
                'ubicacion_id' => $ventaUbicacionId,
                'usuario_id'   => (int) $user->id,
                'cliente_id'   => null,
                'estado'       => 'completada',
                'metodo_pago'  => $data['metodo_pago'],
                'subtotal'     => $subtotal,
                'descuento'    => 0,
                'total'        => $subtotal,
                'creado_en'    => now(),
            ]);

            foreach ($data['items'] as $item) {
                $productoId = (int) $item['producto_id'];
                $productoPrecioId = (int) $item['producto_precio_id'];
                $cantidad = (float) $item['cantidad'];
                $precioUnitario = (float) $item['precio_unitario'];
                $lineSubtotal = $cantidad * $precioUnitario;

                $productoPrecio = ProductoPrecio::query()->find($productoPrecioId);

                VentaTiendaDetalle::create([
                    'venta_id'        => $venta->id,
                    'producto_id'     => (string) $productoId,
                    'cantidad'        => $cantidad,
                    'precio_unitario' => $precioUnitario,
                    'subtotal'        => $lineSubtotal,
                ]);

                $stock = Stock::query()
                    ->where('ubicacion_id', $ventaUbicacionId)
                    ->where('producto_id', $productoId)
                    ->where('producto_precio_id', $productoPrecioId)
                    ->lockForUpdate()
                    ->first();

                $stock->cantidad = max(0, (float) $stock->cantidad - $cantidad);
                $stock->save();

                MovimientoStock::create([
                    'tipo'                 => 'salida',
                    'ubicacion_origen_id'  => $ventaUbicacionId,
                    'ubicacion_destino_id' => null,
                    'producto_id'          => $productoId,
                    'producto_precio_id'   => $productoPrecioId,
                    'presentacion'         => $productoPrecio?->presentacion,
                    'factor_aplicado'      => (float) ($productoPrecio?->factor_base ?? 1),
                    'cantidad'             => $cantidad,
                    'cantidad_base'        => 0,
                    'motivo'               => 'venta_tienda',
                    'referencia_tipo'      => 'venta_tienda',
                    'referencia_id'        => (int) $venta->id,
                    'creado_por'           => (int) $user->id,
                    'creado_en'            => now(),
                ]);
            }

            $venta->load([
                'detalles.producto:id,nombre',
                'usuario:id,nombre,usuario',
                'ubicacion:id,nombre',
                'cliente:id,nombre',
            ]);

            return response()->json([
                'message' => 'Venta realizada correctamente.',
                'data' => $this->buildVentaResponse($venta),
            ], 201);
        });
    }
}