<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Caja;
use App\Models\MovimientoCaja;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class CajaController extends Controller
{
    private function roleOf($user): string
    {
        $r = strtolower(trim((string) ($user->rol ?? $user->role ?? '')));
        $r = str_replace(['-', ' '], '_', $r);

        if ($r === 'superadmin') {
            return 'super_admin';
        }

        if ($r === 'cajero') {
            return 'caja';
        }

        if ($r === 'administrador_de_bodega' || $r === 'adminbod') {
            return 'admin_bodega';
        }

        return $r;
    }

    private function userUbicacionId($user): ?int
    {
        $id = $user->ubicacion_id ?? $user->sucursal_id ?? null;
        return $id ? (int) $id : null;
    }

    private function canManageCaja(string $role): bool
    {
        return in_array($role, ['super_admin', 'admin', 'admin_bodega', 'caja'], true);
    }

    private function canViewCaja(string $role): bool
    {
        return in_array($role, ['super_admin', 'admin', 'admin_bodega', 'caja', 'vendedor_tienda', 'rutero'], true);
    }

    private function resolveUbicacionId(Request $request, string $role): ?int
    {
        if ($role === 'super_admin') {
            $id = $request->query('ubicacion_id', $request->input('ubicacion_id'));
            return $id !== null && $id !== '' ? (int) $id : null;
        }

        return $this->userUbicacionId($request->user());
    }

    private function mapCaja(Caja $caja, bool $withMovimientos = false): array
    {
        $movimientos = $caja->relationLoaded('movimientos')
            ? $caja->movimientos
            : collect();

        $totalIngresos = (float) $movimientos
            ->where('tipo', 'ingreso')
            ->sum('monto');

        $totalEgresos = (float) $movimientos
            ->where('tipo', 'egreso')
            ->sum('monto');

        $saldoEsperado = ((float) $caja->efectivo_inicial + $totalIngresos) - $totalEgresos;

        return [
            'id' => (int) $caja->id,
            'ubicacion_id' => (int) $caja->ubicacion_id,
            'ubicacion' => $caja->relationLoaded('ubicacion') && $caja->ubicacion
                ? [
                    'id' => (int) $caja->ubicacion->id,
                    'nombre' => $caja->ubicacion->nombre,
                ]
                : null,
            'abierto_en' => optional($caja->abierto_en)->toDateTimeString(),
            'cerrado_en' => optional($caja->cerrado_en)->toDateTimeString(),
            'efectivo_inicial' => (float) $caja->efectivo_inicial,
            'efectivo_final' => $caja->efectivo_final !== null ? (float) $caja->efectivo_final : null,
            'notas' => $caja->notas,
            'total_ingresos' => $totalIngresos,
            'total_egresos' => $totalEgresos,
            'saldo_esperado' => $saldoEsperado,
            'movimientos' => $withMovimientos
                ? $movimientos->map(function ($m) {
                    return [
                        'id' => (int) $m->id,
                        'caja_id' => (int) $m->caja_id,
                        'ubicacion_id' => isset($m->ubicacion_id) ? (int) $m->ubicacion_id : null,
                        'tipo' => $m->tipo,
                        'concepto' => $m->concepto,
                        'monto' => (float) $m->monto,
                        'metodo_pago' => $m->metodo_pago,
                        'referencia_tipo' => $m->referencia_tipo,
                        'referencia_id' => $m->referencia_id,
                        'notas' => $m->notas,
                        'creado_en' => optional($m->creado_en)->toDateTimeString(),
                    ];
                })->values()
                : [],
        ];
    }

    public function actual(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);

        if (!$this->canViewCaja($role)) {
            return response()->json([
                'message' => 'No autorizado.'
            ], 403);
        }

        $ubicacionId = $this->resolveUbicacionId($request, $role);

        $query = Caja::query()
            ->with([
                'ubicacion:id,nombre',
                'movimientos' => function ($q) {
                    $q->orderByDesc('creado_en')->orderByDesc('id');
                },
            ])
            ->whereNull('cerrado_en');

        if ($ubicacionId) {
            $query->where('ubicacion_id', $ubicacionId);
        }

        if ($role === 'super_admin' && !$ubicacionId) {
            $rows = $query
                ->orderByDesc('id')
                ->get()
                ->map(fn ($caja) => $this->mapCaja($caja, false))
                ->values();

            return response()->json([
                'data' => $rows,
            ]);
        }

        $caja = $query
            ->latest('id')
            ->first();

        return response()->json([
            'data' => $caja ? $this->mapCaja($caja, true) : null,
        ]);
    }

    public function historial(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);

        if (!$this->canViewCaja($role)) {
            return response()->json([
                'message' => 'No autorizado.'
            ], 403);
        }

        $ubicacionId = $this->resolveUbicacionId($request, $role);
        $perPage = max(1, min((int) $request->query('per_page', 50), 200));
        $mes = trim((string) $request->query('mes', ''));

        $query = Caja::query()
            ->with([
                'ubicacion:id,nombre',
                'movimientos',
            ]);

        if ($ubicacionId) {
            $query->where('ubicacion_id', $ubicacionId);
        }

        if ($mes !== '') {
            try {
                $inicio = Carbon::createFromFormat('Y-m', $mes)->startOfMonth();
                $fin = (clone $inicio)->endOfMonth();

                $query->where(function ($q) use ($inicio, $fin) {
                    $q->whereBetween('abierto_en', [$inicio, $fin])
                      ->orWhereBetween('cerrado_en', [$inicio, $fin]);
                });
            } catch (\Throwable $e) {
                // si el mes viene mal, no filtramos
            }
        }

        $rows = $query
            ->orderByDesc('abierto_en')
            ->orderByDesc('id')
            ->paginate($perPage);

        $rows->setCollection(
            $rows->getCollection()->map(fn ($caja) => $this->mapCaja($caja, false))
        );

        return response()->json($rows);
    }

    public function abrir(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);

        if (!$this->canManageCaja($role)) {
            return response()->json([
                'message' => 'No autorizado.'
            ], 403);
        }

        $data = $request->validate([
            'ubicacion_id' => ['nullable', 'integer'],
            'efectivo_inicial' => ['required', 'numeric', 'min:0'],
            'notas' => ['nullable', 'string', 'max:255'],
        ]);

        $ubicacionId = $role === 'super_admin'
            ? (int) ($data['ubicacion_id'] ?? 0)
            : (int) ($this->userUbicacionId($user) ?? 0);

        if (!$ubicacionId) {
            return response()->json([
                'message' => 'Debes seleccionar una sucursal válida.'
            ], 422);
        }

        $abierta = Caja::query()
            ->where('ubicacion_id', $ubicacionId)
            ->whereNull('cerrado_en')
            ->latest('id')
            ->first();

        if ($abierta) {
            return response()->json([
                'message' => 'Ya existe una caja abierta para esta sucursal.'
            ], 422);
        }

        $caja = Caja::create([
            'ubicacion_id' => $ubicacionId,
            'efectivo_inicial' => (float) $data['efectivo_inicial'],
            'efectivo_final' => null,
            'notas' => $data['notas'] ?? null,
            'abierto_en' => now(),
            'cerrado_en' => null,
        ]);

        $caja->load([
            'ubicacion:id,nombre',
            'movimientos' => function ($q) {
                $q->orderByDesc('creado_en')->orderByDesc('id');
            },
        ]);

        return response()->json([
            'message' => 'Caja abierta correctamente.',
            'data' => $this->mapCaja($caja, true),
        ]);
    }

    public function cerrar(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);

        if (!$this->canManageCaja($role)) {
            return response()->json([
                'message' => 'No autorizado.'
            ], 403);
        }

        $data = $request->validate([
            'ubicacion_id' => ['nullable', 'integer'],
            'efectivo_final' => ['required', 'numeric', 'min:0'],
            'notas' => ['nullable', 'string', 'max:255'],
        ]);

        $ubicacionId = $role === 'super_admin'
            ? (int) ($data['ubicacion_id'] ?? 0)
            : (int) ($this->userUbicacionId($user) ?? 0);

        if (!$ubicacionId) {
            return response()->json([
                'message' => 'Debes seleccionar una sucursal válida.'
            ], 422);
        }

        $caja = Caja::query()
            ->where('ubicacion_id', $ubicacionId)
            ->whereNull('cerrado_en')
            ->latest('id')
            ->first();

        if (!$caja) {
            return response()->json([
                'message' => 'No hay una caja abierta para cerrar.'
            ], 422);
        }

        $caja->efectivo_final = (float) $data['efectivo_final'];
        $caja->cerrado_en = now();
        $caja->notas = $data['notas'] ?? $caja->notas;
        $caja->save();

        $caja->load([
            'ubicacion:id,nombre',
            'movimientos' => function ($q) {
                $q->orderByDesc('creado_en')->orderByDesc('id');
            },
        ]);

        return response()->json([
            'message' => 'Caja cerrada correctamente.',
            'data' => $this->mapCaja($caja, true),
        ]);
    }

    public function registrarEgreso(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);

        if (!$this->canManageCaja($role)) {
            return response()->json([
                'message' => 'No autorizado.'
            ], 403);
        }

        $data = $request->validate([
            'ubicacion_id' => ['required', 'integer'],
            'concepto' => ['required', 'string', 'max:255'],
            'monto' => ['required', 'numeric', 'min:0.01'],
            'referencia' => ['nullable', 'string', 'max:255'],
            'notas' => ['nullable', 'string', 'max:255'],
        ]);

        $ubicacionId = $role === 'super_admin'
            ? (int) $data['ubicacion_id']
            : (int) ($this->userUbicacionId($user) ?? $data['ubicacion_id']);

        if (!$ubicacionId) {
            return response()->json([
                'message' => 'No se encontró una sucursal válida.'
            ], 422);
        }

        $caja = Caja::query()
            ->where('ubicacion_id', $ubicacionId)
            ->whereNull('cerrado_en')
            ->latest('id')
            ->first();

        if (!$caja) {
            return response()->json([
                'message' => 'No hay una caja abierta para registrar el egreso.'
            ], 422);
        }

        MovimientoCaja::create([
            'caja_id' => (int) $caja->id,
            'ubicacion_id' => (int) $ubicacionId,
            'tipo' => 'egreso',
            'concepto' => trim((string) $data['concepto']),
            'monto' => round((float) $data['monto'], 2),
            'metodo_pago' => 'efectivo',
            'referencia_tipo' => !empty($data['referencia']) ? 'egreso_manual' : null,
            'referencia_id' => null,
            'notas' => !empty($data['referencia']) && !empty($data['notas'])
                ? trim((string) $data['referencia']) . ' | ' . trim((string) $data['notas'])
                : (!empty($data['referencia'])
                    ? trim((string) $data['referencia'])
                    : ($data['notas'] ?? null)),
            'creado_en' => now(),
        ]);

        $caja->load([
            'ubicacion:id,nombre',
            'movimientos' => function ($q) {
                $q->orderByDesc('creado_en')->orderByDesc('id');
            },
        ]);

        return response()->json([
            'message' => 'Egreso registrado correctamente.',
            'data' => $this->mapCaja($caja->fresh(['ubicacion:id,nombre', 'movimientos']), true),
        ]);
    }
}