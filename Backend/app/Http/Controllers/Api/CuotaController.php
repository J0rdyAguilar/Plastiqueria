<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AbonoCuota;
use App\Models\Caja;
use App\Models\Cuota;
use App\Models\MovimientoCaja;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CuotaController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $q = trim((string) $request->query('q', ''));
        $estado = trim((string) $request->query('estado', ''));
        $origenTipo = trim((string) $request->query('origen_tipo', ''));
        $ubicacionId = $request->query('ubicacion_id');
        $clienteId = $request->query('cliente_id');
        $soloPendientes = (int) $request->query('solo_pendientes', 0);
        $perPage = max(1, min(100, (int) $request->query('per_page', 20)));

        $role = strtolower((string) ($user->role ?? $user->rol ?? ''));
        $role = str_replace(['-', ' '], '_', $role);
        if ($role === 'superadmin') {
            $role = 'super_admin';
        }

        $query = Cuota::query()
            ->with([
                'cliente:id,nombre,propietario,telefono',
                'ubicacion:id,nombre',
                'rutero:id,nombre,usuario',
                'usuario:id,nombre,usuario',
                'abonos',
            ])
            ->orderByDesc('id');

        if ($role !== 'super_admin') {
            $userUbicacionId = (int) ($user->ubicacion_id ?? 0);
            if ($userUbicacionId > 0) {
                $query->where('ubicacion_id', $userUbicacionId);
            } else {
                $query->whereRaw('1 = 0');
            }
        } elseif (!empty($ubicacionId)) {
            $query->where('ubicacion_id', (int) $ubicacionId);
        }

        if ($estado !== '') {
            $query->where('estado', $estado);
        }

        if ($origenTipo !== '') {
            $query->where('origen_tipo', $origenTipo);
        }

        if (!empty($clienteId)) {
            $query->where('cliente_id', (int) $clienteId);
        }

        if ($soloPendientes === 1) {
            $query->whereIn('estado', ['pendiente', 'parcial']);
            $query->where('saldo_pendiente', '>', 0);
        }

        if ($q !== '') {
            $query->where(function ($sub) use ($q) {
                $sub->where('id', 'like', "%{$q}%")
                    ->orWhere('origen_tipo', 'like', "%{$q}%")
                    ->orWhere('origen_id', 'like', "%{$q}%")
                    ->orWhereHas('cliente', function ($clienteQ) use ($q) {
                        $clienteQ->where('nombre', 'like', "%{$q}%")
                            ->orWhere('propietario', 'like', "%{$q}%")
                            ->orWhere('telefono', 'like', "%{$q}%");
                    });
            });
        }

        $rows = $query->paginate($perPage);

        $rows->getCollection()->transform(function ($cuota) {
            return $this->mapCuota($cuota);
        });

        return response()->json($rows);
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();

        $cuota = Cuota::with([
            'cliente:id,nombre,propietario,telefono',
            'ubicacion:id,nombre',
            'rutero:id,nombre,usuario',
            'usuario:id,nombre,usuario',
            'abonos.usuario:id,nombre,usuario',
            'abonos.caja:id,ubicacion_id,abierto_en,cerrado_en',
        ])->findOrFail($id);

        $this->authorizeUbicacion($user, $cuota->ubicacion_id);

        return response()->json([
            'data' => $this->mapCuota($cuota, true),
        ]);
    }

    public function abonar(Request $request, $id)
    {
        $user = $request->user();

        $validated = $request->validate([
            'monto' => ['required', 'numeric', 'min:0.01'],
            'metodo_pago' => ['required', 'string', Rule::in(['efectivo', 'tarjeta', 'transferencia'])],
            'referencia_pago' => ['nullable', 'string', 'max:255'],
            'observaciones' => ['nullable', 'string'],
        ]);

        $cuota = Cuota::with(['abonos'])->findOrFail($id);

        $this->authorizeUbicacion($user, $cuota->ubicacion_id);

        if ((float) $cuota->saldo_pendiente <= 0 || $cuota->estado === 'pagado') {
            return response()->json([
                'message' => 'Esta cuota ya está pagada.',
            ], 422);
        }

        $monto = round((float) $validated['monto'], 2);
        $saldoActual = round((float) $cuota->saldo_pendiente, 2);

        if ($monto > $saldoActual) {
            return response()->json([
                'message' => 'El monto del abono no puede ser mayor al saldo pendiente.',
                'saldo_pendiente' => $saldoActual,
            ], 422);
        }

        $caja = Caja::query()
            ->where('ubicacion_id', $cuota->ubicacion_id)
            ->whereNull('cerrado_en')
            ->latest('id')
            ->first();

        if (!$caja) {
            return response()->json([
                'message' => 'No hay una caja abierta en esta sucursal para registrar el abono.',
            ], 422);
        }

        DB::beginTransaction();

        try {
            $abono = AbonoCuota::create([
                'cuota_id' => $cuota->id,
                'caja_id' => $caja->id,
                'ubicacion_id' => $cuota->ubicacion_id,
                'cliente_id' => $cuota->cliente_id,
                'usuario_id' => $user->id,
                'monto' => $monto,
                'metodo_pago' => $validated['metodo_pago'],
                'referencia_pago' => $validated['referencia_pago'] ?? null,
                'observaciones' => $validated['observaciones'] ?? null,
                'fecha_pago' => now(),
            ]);

            MovimientoCaja::create([
                'caja_id' => $caja->id,
                'ubicacion_id' => $cuota->ubicacion_id,
                'usuario_id' => $user->id,
                'tipo' => 'ingreso',
                'concepto' => 'Abono de cuota',
                'monto' => $monto,
                'metodo_pago' => $validated['metodo_pago'],
                'referencia_id' => $abono->id,
                'referencia_tipo' => 'cuota_abono',
                'notas' => $this->buildNotasMovimiento($cuota, $validated['observaciones'] ?? null),
            ]);

            $cuota->refresh();
            $cuota->recalcularEstado();

            $cuota->cuotas_pagadas = $this->calcularCuotasPagadas($cuota);
            $cuota->proximo_vencimiento = $this->calcularProximoVencimiento($cuota);
            $cuota->actualizado_por = $user->id;
            $cuota->save();

            DB::commit();

            $cuota->load([
                'cliente:id,nombre,propietario,telefono',
                'ubicacion:id,nombre',
                'rutero:id,nombre,usuario',
                'usuario:id,nombre,usuario',
                'abonos.usuario:id,nombre,usuario',
            ]);

            return response()->json([
                'message' => 'Abono registrado correctamente.',
                'data' => [
                    'abono' => $abono,
                    'cuota' => $this->mapCuota($cuota, true),
                ],
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'No se pudo registrar el abono.',
                'error' => app()->environment('local') ? $e->getMessage() : null,
            ], 500);
        }
    }

    protected function authorizeUbicacion($user, $ubicacionId)
    {
        $role = strtolower((string) ($user->role ?? $user->rol ?? ''));
        $role = str_replace(['-', ' '], '_', $role);

        if ($role === 'superadmin') {
            $role = 'super_admin';
        }

        if ($role === 'super_admin') {
            return true;
        }

        $userUbicacionId = (int) ($user->ubicacion_id ?? 0);
        if ($userUbicacionId <= 0 || $userUbicacionId !== (int) $ubicacionId) {
            abort(403, 'No tienes permiso para ver o modificar cuotas de otra sucursal.');
        }

        return true;
    }

    protected function mapCuota(Cuota $cuota, $withAbonos = false)
    {
        $base = [
            'id' => $cuota->id,
            'ubicacion_id' => $cuota->ubicacion_id,
            'ubicacion_nombre' => $cuota->ubicacion->nombre ?? null,

            'cliente_id' => $cuota->cliente_id,
            'cliente_nombre' => $cuota->cliente->nombre ?? null,
            'cliente_telefono' => $cuota->cliente->telefono ?? null,
            'cliente_propietario' => $cuota->cliente->propietario ?? null,

            'caja_id' => $cuota->caja_id,

            'origen_tipo' => $cuota->origen_tipo,
            'origen_id' => $cuota->origen_id,

            'rutero_id' => $cuota->rutero_id,
            'rutero_nombre' => $cuota->rutero->nombre ?? $cuota->rutero->usuario ?? null,

            'usuario_id' => $cuota->usuario_id,
            'usuario_nombre' => $cuota->usuario->nombre ?? $cuota->usuario->usuario ?? null,

            'total_credito' => (float) $cuota->total_credito,
            'total_abonado' => (float) $cuota->total_abonado,
            'saldo_pendiente' => (float) $cuota->saldo_pendiente,

            'numero_cuotas' => (int) ($cuota->numero_cuotas ?? 1),
            'cuotas_pagadas' => (int) ($cuota->cuotas_pagadas ?? 0),
            'frecuencia_pago' => $cuota->frecuencia_pago ?? 'mensual',
            'monto_por_cuota' => (float) ($cuota->monto_por_cuota ?? 0),
            'dia_pago' => $cuota->dia_pago !== null ? (int) $cuota->dia_pago : null,
            'proximo_vencimiento' => optional($cuota->proximo_vencimiento)->format('Y-m-d H:i:s'),

            'estado' => $cuota->estado,

            'fecha_inicio' => optional($cuota->fecha_inicio)->format('Y-m-d H:i:s'),
            'fecha_vencimiento' => optional($cuota->fecha_vencimiento)->format('Y-m-d H:i:s'),
            'observaciones' => $cuota->observaciones,

            'creado_por' => $cuota->creado_por,
            'actualizado_por' => $cuota->actualizado_por,
            'creado_en' => optional($cuota->creado_en)->format('Y-m-d H:i:s'),
            'actualizado_en' => optional($cuota->actualizado_en)->format('Y-m-d H:i:s'),
        ];

        if ($withAbonos) {
            $base['abonos'] = $cuota->abonos->map(function ($abono) {
                return [
                    'id' => $abono->id,
                    'cuota_id' => $abono->cuota_id,
                    'caja_id' => $abono->caja_id,
                    'ubicacion_id' => $abono->ubicacion_id,
                    'cliente_id' => $abono->cliente_id,
                    'usuario_id' => $abono->usuario_id,
                    'usuario_nombre' => $abono->usuario->nombre ?? $abono->usuario->usuario ?? null,
                    'monto' => (float) $abono->monto,
                    'metodo_pago' => $abono->metodo_pago,
                    'referencia_pago' => $abono->referencia_pago,
                    'observaciones' => $abono->observaciones,
                    'fecha_pago' => optional($abono->fecha_pago)->format('Y-m-d H:i:s'),
                    'creado_en' => optional($abono->creado_en)->format('Y-m-d H:i:s'),
                ];
            })->values();
        }

        return $base;
    }

    protected function buildNotasMovimiento(Cuota $cuota, ?string $observaciones = null): string
    {
        $parts = [
            'Cuota #' . $cuota->id,
            'Origen: ' . $cuota->origen_tipo,
            'Origen ID: ' . $cuota->origen_id,
        ];

        if ($cuota->cliente_id) {
            $parts[] = 'Cliente ID: ' . $cuota->cliente_id;
        }

        if (!empty($cuota->numero_cuotas)) {
            $parts[] = 'Plan: ' . $cuota->numero_cuotas . ' cuota(s)';
        }

        if (!empty($cuota->frecuencia_pago)) {
            $parts[] = 'Frecuencia: ' . $cuota->frecuencia_pago;
        }

        if ($observaciones) {
            $parts[] = 'Obs: ' . $observaciones;
        }

        return implode(' | ', $parts);
    }

    protected function calcularCuotasPagadas(Cuota $cuota): int
    {
        $montoPorCuota = round((float) ($cuota->monto_por_cuota ?? 0), 2);
        $totalAbonado = round((float) ($cuota->total_abonado ?? 0), 2);
        $numeroCuotas = max(1, (int) ($cuota->numero_cuotas ?? 1));

        if ($montoPorCuota <= 0) {
            return 0;
        }

        return min((int) floor($totalAbonado / $montoPorCuota), $numeroCuotas);
    }

    protected function calcularProximoVencimiento(Cuota $cuota): ?Carbon
    {
        if ($cuota->estado === 'pagado' || (float) $cuota->saldo_pendiente <= 0) {
            return null;
        }

        $numeroCuotas = max(1, (int) ($cuota->numero_cuotas ?? 1));
        $cuotasPagadas = min((int) ($cuota->cuotas_pagadas ?? 0), $numeroCuotas - 1);
        $frecuencia = (string) ($cuota->frecuencia_pago ?? 'mensual');

        $base = $cuota->fecha_inicio
            ? Carbon::parse($cuota->fecha_inicio)
            : Carbon::now();

        if ($cuota->proximo_vencimiento) {
            $base = Carbon::parse($cuota->proximo_vencimiento);
        }

        if ($cuotasPagadas <= 0) {
            return $base;
        }

        $inicio = $cuota->fecha_inicio
            ? Carbon::parse($cuota->fecha_inicio)
            : Carbon::now();

        $primer = $cuota->proximo_vencimiento
            ? Carbon::parse($cuota->proximo_vencimiento)
            : $inicio;

        $siguiente = $primer->copy();

        for ($i = 0; $i < $cuotasPagadas; $i++) {
            if ($frecuencia === 'semanal') {
                $siguiente->addWeek();
            } elseif ($frecuencia === 'quincenal') {
                $siguiente->addDays(15);
            } else {
                $siguiente->addMonth();
            }
        }

        return $siguiente;
    }
}