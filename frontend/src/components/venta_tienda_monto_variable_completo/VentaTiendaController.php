<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VentaTienda;
use App\Models\VentaTiendaDetalle;
use App\Models\Stock;
use App\Models\MovimientoStock;
use App\Models\ProductoPrecio;
use App\Models\Caja;
use App\Models\MovimientoCaja;
use App\Models\Ubicacion;
use App\Services\RegistrarCuotaService;
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

    private function cantidadBaseDesdeProductoPrecio($productoPrecio, float $cantidad): float
    {
        if (!$productoPrecio) {
            return round($cantidad, 4);
        }

        $factor = null;

        foreach ([
            'factor',
            'factor_conversion',
            'equivalencia',
            'multiplicador',
            'contenido',
            'cantidad_base',
            'unidades',
        ] as $campo) {
            if (isset($productoPrecio->{$campo}) && is_numeric($productoPrecio->{$campo})) {
                $valor = (float) $productoPrecio->{$campo};
                if ($valor > 0) {
                    $factor = $valor;
                    break;
                }
            }
        }

        if ($factor === null || $factor <= 0) {
            $factor = 1;
        }

        return round($cantidad * $factor, 4);
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
                'es_monto_variable' => (bool) ($d->es_monto_variable ?? false),
            ];
        })->values();

        return [
            'id' => (int) $venta->id,
            'ubicacion_id' => (int) $venta->ubicacion_id,
            'ubicacion_nombre' => $venta->ubicacion?->nombre,
            'usuario_id' => (int) $venta->usuario_id,
            'usuario_nombre' => $venta->usuario?->nombre ?? $venta->usuario?->usuario,
            'cliente_id' => $venta->cliente_id ? (int) $venta->cliente_id : null,
            'cliente_nombre' => $venta->cliente?->nombre,
            'estado' => $venta->estado,
            'metodo_pago' => $venta->metodo_pago,
            'referencia_pago' => $venta->referencia_pago,
            'subtotal' => (float) ($venta->subtotal ?? 0),
            'descuento' => (float) ($venta->descuento ?? 0),
            'total' => (float) ($venta->total ?? 0),
            'saldo_pendiente' => (float) ($venta->saldo_pendiente ?? 0),
            'monto_variable_estado' => $venta->monto_variable_estado,
            'monto_variable_aprobado_por' => $venta->monto_variable_aprobado_por,
            'monto_variable_aprobado_en' => optional($venta->monto_variable_aprobado_en)->format('Y-m-d H:i:s'),
            'tiene_monto_variable' => $detalles->contains(fn($d) => !empty($d['es_monto_variable'])),
            'ganancia_total' => (float) $detalles->sum('ganancia_total'),
            'creado_en' => optional($venta->creado_en)->format('Y-m-d H:i:s'),
            'detalles' => $detalles,
        ];
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $userUbicacionId = $this->userUbicacionId($user);

        if (!in_array($role, ['admin', 'super_admin', 'vendedor-tienda'], true)) {
            return response()->json([
                'message' => 'No autorizado.'
            ], 403);
        }

        $q = trim((string) $request->query('q', ''));
        $estado = trim((string) $request->query('estado', ''));
        $metodoPago = trim((string) $request->query('metodo_pago', ''));
        $fechaDesde = trim((string) $request->query('fecha_desde', ''));
        $fechaHasta = trim((string) $request->query('fecha_hasta', ''));
        $soloMias = (int) $request->query('solo_mias', 0);
        $perPage = max(1, min(100, (int) $request->query('per_page', 20)));

        $query = VentaTienda::query()
            ->with([
                'ubicacion:id,nombre',
                'usuario:id,usuario,nombre',
                'cliente:id,nombre',
                'detalles.producto:id,nombre',
            ])
            ->orderByDesc('id');

        if ($role === 'super_admin') {
            $ubicacionId = $request->query('ubicacion_id');
            if (!empty($ubicacionId)) {
                $query->where('ubicacion_id', (int) $ubicacionId);
            }
        } else {
            if (!$userUbicacionId) {
                return response()->json([
                    'message' => 'El usuario no tiene sucursal asignada.'
                ], 403);
            }

            $query->where('ubicacion_id', $userUbicacionId);
        }

        if ($soloMias === 1) {
            $query->where('usuario_id', (int) $user->id);
        }

        if ($estado !== '') {
            $query->where('estado', $estado);
        }

        if ($metodoPago !== '') {
            $query->where('metodo_pago', $metodoPago);
        }

        if ($fechaDesde !== '') {
            $query->whereDate('creado_en', '>=', $fechaDesde);
        }

        if ($fechaHasta !== '') {
            $query->whereDate('creado_en', '<=', $fechaHasta);
        }

        if ($q !== '') {
            $query->where(function ($sub) use ($q) {
                $sub->where('id', 'like', "%{$q}%")
                    ->orWhere('metodo_pago', 'like', "%{$q}%")
                    ->orWhereHas('cliente', function ($cq) use ($q) {
                        $cq->where('nombre', 'like', "%{$q}%");
                    })
                    ->orWhereHas('usuario', function ($uq) use ($q) {
                        $uq->where('usuario', 'like', "%{$q}%")
                            ->orWhere('nombre', 'like', "%{$q}%");
                    })
                    ->orWhereHas('detalles.producto', function ($pq) use ($q) {
                        $pq->where('nombre', 'like', "%{$q}%");
                    });
            });
        }

        $items = $query->paginate($perPage);

        $ids = collect($items->items())->pluck('id')->all();

        $movimientos = empty($ids)
            ? collect()
            : MovimientoStock::query()
                ->where('referencia_tipo', 'venta_tienda')
                ->whereIn('referencia_id', $ids)
                ->get()
                ->groupBy('referencia_id');

        $precioIds = collect($movimientos)
            ->flatten(1)
            ->pluck('producto_precio_id')
            ->filter()
            ->unique()
            ->values();

        $preciosById = ProductoPrecio::query()
            ->whereIn('id', $precioIds)
            ->get()
            ->keyBy('id');

        $items->setCollection(
            $items->getCollection()->map(function ($venta) use ($movimientos, $preciosById) {
                return $this->buildVentaResponse($venta, $movimientos, $preciosById);
            })
        );

        return response()->json($items);
    }

    public function registro(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $userUbicacionId = $this->userUbicacionId($user);

        if (!in_array($role, ['admin', 'super_admin', 'vendedor-tienda'], true)) {
            return response()->json([
                'message' => 'No autorizado.'
            ], 403);
        }

        $fechaDesde = trim((string) $request->query('fecha_desde', ''));
        $fechaHasta = trim((string) $request->query('fecha_hasta', ''));
        $metodoPago = trim((string) $request->query('metodo_pago', ''));
        $ubicacionId = $request->query('ubicacion_id');
        $soloMias = (int) $request->query('solo_mias', 0);
        $perPage = max(1, min(100, (int) $request->query('per_page', 30)));

        $ventasQuery = VentaTienda::query()
            ->with([
                'ubicacion:id,nombre',
                'usuario:id,usuario,nombre',
                'cliente:id,nombre',
                'detalles.producto:id,nombre',
            ])
            ->orderByDesc('id');

        if ($role === 'super_admin') {
            if (!empty($ubicacionId)) {
                $ventasQuery->where('ubicacion_id', (int) $ubicacionId);
            }
        } else {
            if (!$userUbicacionId) {
                return response()->json([
                    'message' => 'El usuario no tiene sucursal asignada.'
                ], 403);
            }

            $ventasQuery->where('ubicacion_id', $userUbicacionId);
        }

        if ($soloMias === 1) {
            $ventasQuery->where('usuario_id', (int) $user->id);
        }

        if ($metodoPago !== '') {
            $ventasQuery->where('metodo_pago', $metodoPago);
        }

        if ($fechaDesde !== '') {
            $ventasQuery->whereDate('creado_en', '>=', $fechaDesde);
        }

        if ($fechaHasta !== '') {
            $ventasQuery->whereDate('creado_en', '<=', $fechaHasta);
        }

        $items = $ventasQuery->paginate($perPage);

        $ids = collect($items->items())->pluck('id')->all();

        $movimientos = empty($ids)
            ? collect()
            : MovimientoStock::query()
                ->where('referencia_tipo', 'venta_tienda')
                ->whereIn('referencia_id', $ids)
                ->get()
                ->groupBy('referencia_id');

        $precioIds = collect($movimientos)
            ->flatten(1)
            ->pluck('producto_precio_id')
            ->filter()
            ->unique()
            ->values();

        $preciosById = ProductoPrecio::query()
            ->whereIn('id', $precioIds)
            ->get()
            ->keyBy('id');

        $data = collect($items->items())->map(function ($venta) use ($movimientos, $preciosById) {
            return $this->buildVentaResponse($venta, $movimientos, $preciosById);
        })->values();

        if ($role === 'super_admin') {
            $sucursales = Ubicacion::query()
                ->select('id', 'nombre')
                ->orderBy('nombre')
                ->get();
        } else {
            $sucursales = Ubicacion::query()
                ->select('id', 'nombre')
                ->where('id', $userUbicacionId)
                ->orderBy('nombre')
                ->get();
        }

        return response()->json([
            'data' => $data,
            'sucursales' => $sucursales,
            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
            ],
        ]);
    }

    public function show(Request $request, VentaTienda $venta)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $userUbicacionId = $this->userUbicacionId($user);

        if (!in_array($role, ['admin', 'super_admin', 'vendedor-tienda'], true)) {
            return response()->json([
                'message' => 'No autorizado.'
            ], 403);
        }

        if ($role !== 'super_admin') {
            if (!$userUbicacionId || (int) $venta->ubicacion_id !== (int) $userUbicacionId) {
                return response()->json([
                    'message' => 'No autorizado para ver esta venta.'
                ], 403);
            }
        }

        $venta->load([
            'ubicacion:id,nombre',
            'usuario:id,usuario,nombre',
            'cliente:id,nombre',
            'detalles.producto:id,nombre',
        ]);

        return response()->json([
            'data' => $this->buildVentaResponse($venta),
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
            'cliente_id' => ['nullable', 'integer', 'exists:clientes,id'],
            'metodo_pago' => ['required', 'string', 'in:efectivo,tarjeta,cuotas'],
            'referencia_pago' => ['nullable', 'string', 'max:255'],
            'nombre_comprador' => ['nullable', 'string', 'max:150'],

            'numero_cuotas' => ['nullable', 'integer', 'min:1', 'max:24'],
            'frecuencia_pago' => ['nullable', 'string', 'in:semanal,quincenal,mensual'],
            'fecha_primer_pago' => ['nullable', 'date'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.producto_id' => ['required', 'integer', 'exists:productos,id'],
            'items.*.producto_precio_id' => ['required', 'integer', 'exists:producto_precios,id'],
            'items.*.presentacion' => ['nullable', 'string', 'max:100'],
            'items.*.cantidad' => ['required', 'numeric', 'min:0.01'],
            'items.*.precio_unitario' => ['required', 'numeric', 'min:0.01'],
            'items.*.es_monto_variable' => ['nullable', 'in:0,1,true,false'],
        ]);

        if (($data['metodo_pago'] ?? '') === 'cuotas') {
            if (empty($data['cliente_id'])) {
                return response()->json([
                    'message' => 'Para ventas con cuotas debes seleccionar un cliente.'
                ], 422);
            }

            if (empty($data['numero_cuotas']) || (int) $data['numero_cuotas'] < 1) {
                return response()->json([
                    'message' => 'Debes indicar el número de cuotas.'
                ], 422);
            }
        }

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
            $itemsPreparados = [];
            $tieneMontoVariable = false;

            foreach ($data['items'] as $item) {
                $productoId = (int) $item['producto_id'];
                $productoPrecioId = (int) $item['producto_precio_id'];
                $cantidad = (float) $item['cantidad'];
                $precioUnitario = (float) $item['precio_unitario'];
                $esMontoVariable = !empty($item['es_monto_variable']);

                if ($esMontoVariable) {
                    $tieneMontoVariable = true;
                }

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

                $productoPrecio = ProductoPrecio::query()->find($productoPrecioId);
                $cantidadBase = $this->cantidadBaseDesdeProductoPrecio($productoPrecio, $cantidad);

                $disponible = (float) ($stock->cantidad ?? 0);

                if ($disponible < $cantidad) {
                    return response()->json([
                        'message' => "Stock insuficiente para el producto {$productoId}. Disponible: {$disponible}"
                    ], 422);
                }

                $subtotalItem = round($cantidad * $precioUnitario, 2);
                $subtotal += $subtotalItem;

                $itemsPreparados[] = [
                    'producto_id' => $productoId,
                    'producto_precio_id' => $productoPrecioId,
                    'cantidad' => $cantidad,
                    'cantidad_base' => $cantidadBase,
                    'precio_unitario' => $precioUnitario,
                    'subtotal' => $subtotalItem,
                    'presentacion' => $item['presentacion'] ?? null,
                    'es_monto_variable' => $esMontoVariable ? 1 : 0,
                ];
            }

            $esCuotas = ($data['metodo_pago'] ?? 'efectivo') === 'cuotas';
            $total = round((float) $subtotal, 2);

            $venta = VentaTienda::create([
                'ubicacion_id'    => $ventaUbicacionId,
                'usuario_id'      => (int) $user->id,
                'cliente_id'      => !empty($data['cliente_id']) ? (int) $data['cliente_id'] : null,
                'estado'          => 'completada',
                'metodo_pago'     => $data['metodo_pago'],
                'referencia_pago' => $data['referencia_pago'] ?? null,
                'subtotal'        => $total,
                'descuento'       => 0,
                'total'           => $total,
                'saldo_pendiente' => $esCuotas ? $total : 0,
                'monto_variable_estado' => $tieneMontoVariable ? 'pendiente' : null,
                'monto_variable_aprobado_por' => null,
                'monto_variable_aprobado_en' => null,
                'creado_en'       => now(),
            ]);

            foreach ($itemsPreparados as $item) {
                VentaTiendaDetalle::create([
                    'venta_id'        => (int) $venta->id,
                    'producto_id'     => $item['producto_id'],
                    'cantidad'        => $item['cantidad'],
                    'precio_unitario' => $item['precio_unitario'],
                    'subtotal'        => $item['subtotal'],
                    'es_monto_variable' => $item['es_monto_variable'],
                ]);

                $stock = Stock::query()
                    ->where('ubicacion_id', $ventaUbicacionId)
                    ->where('producto_id', $item['producto_id'])
                    ->where('producto_precio_id', $item['producto_precio_id'])
                    ->lockForUpdate()
                    ->first();

                $stock->cantidad = (float) $stock->cantidad - (float) $item['cantidad'];
                $stock->save();

                MovimientoStock::create([
                    'tipo' => 'salida',
                    'producto_id' => $item['producto_id'],
                    'producto_precio_id' => $item['producto_precio_id'],
                    'ubicacion_origen_id' => $ventaUbicacionId,
                    'ubicacion_destino_id' => null,
                    'cantidad' => $item['cantidad'],
                    'cantidad_base' => $item['cantidad_base'],
                    'presentacion' => $item['presentacion'],
                    'motivo' => 'Venta tienda',
                    'referencia_tipo' => 'venta_tienda',
                    'referencia_id' => (int) $venta->id,
                    'creado_por' => (int) $user->id,
                    'creado_en' => now(),
                ]);
            }

            if (!$esCuotas) {
                $caja = Caja::query()
                    ->where('ubicacion_id', $ventaUbicacionId)
                    ->whereNull('cerrado_en')
                    ->latest('id')
                    ->first();

                if (!$caja) {
                    return response()->json([
                        'message' => 'No hay una caja abierta en esta sucursal para registrar la venta.'
                    ], 422);
                }

                MovimientoCaja::create([
                    'caja_id' => (int) $caja->id,
                    'ubicacion_id' => (int) $ventaUbicacionId,
                    'usuario_id' => (int) $user->id,
                    'tipo' => 'ingreso',
                    'concepto' => 'venta_tienda',
                    'monto' => $total,
                    'metodo_pago' => $data['metodo_pago'],
                    'referencia_id' => (int) $venta->id,
                    'referencia_tipo' => 'venta_tienda',
                    'notas' => 'Venta registrada desde módulo de tienda'
                        . (!empty($data['nombre_comprador']) ? ' | Comprador: ' . $data['nombre_comprador'] : '')
                        . (!empty($data['referencia_pago']) ? ' | Ref: ' . $data['referencia_pago'] : ''),
                ]);
            }

            if ($esCuotas) {
                app(RegistrarCuotaService::class)->registrarVentaTienda([
                    'venta_id' => (int) $venta->id,
                    'cliente_id' => (int) $data['cliente_id'],
                    'ubicacion_id' => (int) $ventaUbicacionId,
                    'rutero_id' => null,
                    'usuario_id' => (int) $user->id,
                    'total' => $total,
                    'numero_cuotas' => (int) $data['numero_cuotas'],
                    'frecuencia_pago' => $data['frecuencia_pago'] ?? 'mensual',
                    'fecha_primer_pago' => !empty($data['fecha_primer_pago'])
                        ? Carbon::parse($data['fecha_primer_pago'])
                        : now()->addMonth(),
                    'observaciones' => $data['referencia_pago'] ?? null,
                ]);
            }

            $venta->load([
                'ubicacion:id,nombre',
                'usuario:id,usuario,nombre',
                'cliente:id,nombre',
                'detalles.producto:id,nombre',
            ]);

            return response()->json([
                'message' => $esCuotas
                    ? 'Venta a crédito registrada correctamente.'
                    : 'Venta registrada correctamente.',
                'data' => $this->buildVentaResponse($venta),
            ], 201);
        });
    }


    public function montosVariablesPendientes(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);

        if ($role !== 'super_admin') {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $ventas = VentaTienda::query()
            ->with([
                'ubicacion:id,nombre',
                'usuario:id,usuario,nombre',
                'cliente:id,nombre',
                'detalles.producto:id,nombre',
            ])
            ->where('monto_variable_estado', 'pendiente')
            ->orderByDesc('creado_en')
            ->limit(50)
            ->get();

        return response()->json([
            'data' => $ventas
                ->map(fn($venta) => $this->buildVentaResponse($venta))
                ->values(),
        ]);
    }

    public function aprobarMontoVariable(VentaTienda $venta, Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);

        if ($role !== 'super_admin') {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($venta->monto_variable_estado === 'aprobado') {
            return response()->json(['message' => 'Este monto variable ya fue aprobado.'], 422);
        }

        if ($venta->monto_variable_estado === 'rechazado') {
            return response()->json(['message' => 'Este monto variable ya fue rechazado.'], 422);
        }

        if ($venta->monto_variable_estado !== 'pendiente') {
            return response()->json(['message' => 'Esta venta no tiene monto variable pendiente.'], 422);
        }

        $venta->monto_variable_estado = 'aprobado';
        $venta->monto_variable_aprobado_por = (int) $user->id;
        $venta->monto_variable_aprobado_en = now();
        $venta->save();

        $venta->load([
            'ubicacion:id,nombre',
            'usuario:id,usuario,nombre',
            'cliente:id,nombre',
            'detalles.producto:id,nombre',
        ]);

        return response()->json([
            'message' => 'Monto variable de venta tienda aprobado correctamente.',
            'data' => $this->buildVentaResponse($venta),
        ]);
    }

    public function rechazarMontoVariable(VentaTienda $venta, Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);

        if ($role !== 'super_admin') {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($venta->monto_variable_estado === 'aprobado') {
            return response()->json(['message' => 'Este monto variable ya fue aprobado.'], 422);
        }

        if ($venta->monto_variable_estado === 'rechazado') {
            return response()->json(['message' => 'Este monto variable ya fue rechazado.'], 422);
        }

        if ($venta->monto_variable_estado !== 'pendiente') {
            return response()->json(['message' => 'Esta venta no tiene monto variable pendiente.'], 422);
        }

        $venta->monto_variable_estado = 'rechazado';
        $venta->monto_variable_aprobado_por = (int) $user->id;
        $venta->monto_variable_aprobado_en = now();
        $venta->save();

        $venta->load([
            'ubicacion:id,nombre',
            'usuario:id,usuario,nombre',
            'cliente:id,nombre',
            'detalles.producto:id,nombre',
        ]);

        return response()->json([
            'message' => 'Monto variable de venta tienda rechazado correctamente.',
            'data' => $this->buildVentaResponse($venta),
        ]);
    }
}