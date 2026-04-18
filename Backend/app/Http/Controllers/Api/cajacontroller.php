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

        return $r;
    }

    private function userUbicacionId($user): ?int
    {
        $id = $user->ubicacion_id ?? $user->sucursal_id ?? null;
        return $id ? (int) $id : null;
    }

    private function canManageCaja(string $role): bool
    {
        return in_array($role, ['super_admin', 'admin', 'caja'], true);
    }

    private function resolveUbicacionId(Request $request): ?int
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $requested = $request->query('ubicacion_id');

        if ($role === 'super_admin') {
            return $requested ? (int) $requested : null;
        }

        return $this->userUbicacionId($user);
    }

    private function formatDateTime($value): ?string
    {
        if (!$value) {
            return null;
        }

        try {
            return $value->format('Y-m-d H:i:s');
        } catch (\Throwable $e) {
            try {
                return Carbon::parse($value)->format('Y-m-d H:i:s');
            } catch (\Throwable $e2) {
                return (string) $value;
            }
        }
    }

    private function parseMes(?string $mes): array
    {
        $mes = trim((string) $mes);

        if ($mes === '') {
            $inicio = now()->startOfMonth();
            $fin = now()->endOfMonth();
            return [$inicio, $fin];
        }

        try {
            $inicio = Carbon::createFromFormat('Y-m', $mes)->startOfMonth();
            $fin = (clone $inicio)->endOfMonth();
            return [$inicio, $fin];
        } catch (\Throwable $e) {
            $inicio = now()->startOfMonth();
            $fin = now()->endOfMonth();
            return [$inicio, $fin];
        }
    }

    private function calcularTotalesCaja(Caja $caja): array
    {
        $ingresos = (float) MovimientoCaja::query()
            ->where('caja_id', (int) $caja->id)
            ->where('tipo', 'ingreso')
            ->sum('monto');

        $egresos = (float) MovimientoCaja::query()
            ->where('caja_id', (int) $caja->id)
            ->where('tipo', 'egreso')
            ->sum('monto');

        $inicial = (float) ($caja->efectivo_inicial ?? 0);
        $saldoEsperado = $inicial + $ingresos - $egresos;

        return [
            'ingresos' => round($ingresos, 2),
            'egresos' => round($egresos, 2),
            'saldo_esperado' => round($saldoEsperado, 2),
        ];
    }

    private function mapMovimiento($m): array
    {
        return [
            'id' => (int) $m->id,
            'tipo' => $m->tipo,
            'concepto' => $m->concepto,
            'monto' => (float) $m->monto,
            'metodo_pago' => $m->metodo_pago,
            'referencia_id' => $m->referencia_id,
            'referencia_tipo' => $m->referencia_tipo,
            'notas' => $m->notas,
            'creado_en' => $this->formatDateTime($m->creado_en ?? $m->created_at ?? null),
        ];
    }

    private function mapCaja(Caja $caja, bool $withMovimientos = false): array
    {
        $totales = $this->calcularTotalesCaja($caja);

        $base = [
            'id' => (int) $caja->id,
            'ubicacion_id' => (int) $caja->ubicacion_id,
            'usuario_id' => !empty($caja->abierto_por) ? (int) $caja->abierto_por : null,
            'ubicacion' => $caja->ubicacion ? [
                'id' => (int) $caja->ubicacion->id,
                'nombre' => $caja->ubicacion->nombre,
            ] : null,
            'abierto_en' => $this->formatDateTime($caja->abierto_en),
            'cerrado_en' => $this->formatDateTime($caja->cerrado_en),
            'efectivo_inicial' => (float) ($caja->efectivo_inicial ?? 0),
            'efectivo_final' => $caja->efectivo_final !== null ? (float) $caja->efectivo_final : null,
            'notas' => $caja->notas,
            'total_ingresos' => (float) $totales['ingresos'],
            'total_egresos' => (float) $totales['egresos'],
            'saldo_esperado' => (float) $totales['saldo_esperado'],
        ];

        if ($withMovimientos) {
            $base['movimientos'] = MovimientoCaja::query()
                ->where('caja_id', (int) $caja->id)
                ->orderByDesc('id')
                ->limit(100)
                ->get()
                ->map(fn ($m) => $this->mapMovimiento($m))
                ->values();
        }

        return $base;
    }

    public function actual(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $ubicacionId = $this->resolveUbicacionId($request);

        if ($role === 'super_admin' && !$ubicacionId) {
            $cajas = Caja::query()
                ->with('ubicacion:id,nombre')
                ->whereNull('cerrado_en')
                ->orderByDesc('id')
                ->get()
                ->groupBy('ubicacion_id')
                ->map(function ($group) {
                    return $this->mapCaja($group->first(), true);
                })
                ->values();

            return response()->json([
                'data' => $cajas,
                'modo' => 'todas',
            ]);
        }

        if (!$ubicacionId) {
            return response()->json([
                'message' => 'El usuario no tiene una sucursal asignada.'
            ], 422);
        }

        $caja = Caja::query()
            ->with('ubicacion:id,nombre')
            ->where('ubicacion_id', $ubicacionId)
            ->whereNull('cerrado_en')
            ->latest('id')
            ->first();

        if (!$caja) {
            return response()->json([
                'data' => null,
                'modo' => 'una',
            ]);
        }

        return response()->json([
            'data' => $this->mapCaja($caja, true),
            'modo' => 'una',
        ]);
    }

    public function historial(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $ubicacionId = $this->resolveUbicacionId($request);
        $perPage = max(1, min(100, (int) $request->query('per_page', 20)));
        [$inicio, $fin] = $this->parseMes($request->query('mes'));

        $query = Caja::query()
            ->with('ubicacion:id,nombre')
            ->whereBetween('abierto_en', [$inicio, $fin]);

        if ($role === 'super_admin') {
            if ($ubicacionId) {
                $query->where('ubicacion_id', $ubicacionId);
            }
        } else {
            if (!$ubicacionId) {
                return response()->json([
                    'data' => [],
                ]);
            }

            $query->where('ubicacion_id', $ubicacionId);
        }

        $items = $query
            ->orderByDesc('id')
            ->paginate($perPage);

        $items->setCollection(
            $items->getCollection()->map(function ($caja) {
                return $this->mapCaja($caja, false);
            })
        );

        return response()->json($items);
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
            'ubicacion_id' => ['required', 'integer'],
            'efectivo_inicial' => ['required', 'numeric', 'min:0'],
            'notas' => ['nullable', 'string', 'max:255'],
        ]);

        $ubicacionId = $role === 'super_admin'
            ? (int) $data['ubicacion_id']
            : $this->userUbicacionId($user);

        if (!$ubicacionId) {
            return response()->json([
                'message' => 'No se encontró una sucursal válida.'
            ], 422);
        }

        $abierta = Caja::query()
            ->where('ubicacion_id', $ubicacionId)
            ->whereNull('cerrado_en')
            ->exists();

        if ($abierta) {
            return response()->json([
                'message' => 'Ya existe una caja abierta para esta sucursal.'
            ], 422);
        }

        $caja = Caja::create([
            'ubicacion_id' => $ubicacionId,
            'abierto_por' => (int) $user->id,
            'abierto_en' => now(),
            'efectivo_inicial' => round((float) $data['efectivo_inicial'], 2),
            'notas' => $data['notas'] ?? null,
        ]);

        $caja->load('ubicacion:id,nombre');

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
            'ubicacion_id' => ['required', 'integer'],
            'efectivo_final' => ['required', 'numeric', 'min:0'],
            'notas' => ['nullable', 'string', 'max:255'],
        ]);

        $ubicacionId = $role === 'super_admin'
            ? (int) $data['ubicacion_id']
            : $this->userUbicacionId($user);

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
                'message' => 'No hay una caja abierta para cerrar.'
            ], 422);
        }

        $caja->cerrado_en = now();
        $caja->efectivo_final = round((float) $data['efectivo_final'], 2);
        $caja->notas = $data['notas'] ?? $caja->notas;
        $caja->save();

        $caja->load('ubicacion:id,nombre');

        return response()->json([
            'message' => 'Caja cerrada correctamente.',
            'data' => $this->mapCaja($caja, true),
        ]);
    }
}