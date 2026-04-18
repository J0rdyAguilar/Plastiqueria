<?php

namespace App\Services;

use App\Models\Cuota;
use Carbon\Carbon;

class RegistrarCuotaService
{
    private function calcularMontoPorCuota(float $total, int $numeroCuotas): float
    {
        $numeroCuotas = max(1, $numeroCuotas);
        return round($total / $numeroCuotas, 2);
    }

    private function calcularPrimerVencimiento(?string $fechaPrimerPago, string $frecuencia): Carbon
    {
        if (!empty($fechaPrimerPago)) {
            return Carbon::parse($fechaPrimerPago)->startOfDay();
        }

        return match ($frecuencia) {
            'semanal' => now()->addWeek()->startOfDay(),
            'quincenal' => now()->addDays(15)->startOfDay(),
            default => now()->addMonth()->startOfDay(),
        };
    }

    public function crearDesdeVentaTienda($ventaTienda, $user, array $extra = [])
    {
        $total = round((float) ($ventaTienda->total ?? 0), 2);

        $numeroCuotas = max(1, (int) ($extra['numero_cuotas'] ?? 1));
        $frecuenciaPago = (string) ($extra['frecuencia_pago'] ?? 'mensual');
        $primerVencimiento = $this->calcularPrimerVencimiento(
            $extra['fecha_primer_pago'] ?? null,
            $frecuenciaPago
        );

        return Cuota::create([
            'ubicacion_id' => (int) ($ventaTienda->ubicacion_id ?? 0),
            'cliente_id' => !empty($ventaTienda->cliente_id) ? (int) $ventaTienda->cliente_id : null,
            'caja_id' => !empty($ventaTienda->caja_id) ? (int) $ventaTienda->caja_id : null,
            'origen_tipo' => 'venta_tienda',
            'origen_id' => (int) $ventaTienda->id,
            'rutero_id' => null,
            'usuario_id' => !empty($ventaTienda->usuario_id) ? (int) $ventaTienda->usuario_id : (int) ($user->id ?? 0),
            'total_credito' => $total,
            'total_abonado' => 0,
            'saldo_pendiente' => $total,
            'numero_cuotas' => $numeroCuotas,
            'cuotas_pagadas' => 0,
            'frecuencia_pago' => $frecuenciaPago,
            'monto_por_cuota' => $this->calcularMontoPorCuota($total, $numeroCuotas),
            'dia_pago' => (int) $primerVencimiento->day,
            'estado' => 'pendiente',
            'fecha_inicio' => now(),
            'fecha_vencimiento' => $extra['fecha_vencimiento'] ?? null,
            'proximo_vencimiento' => $primerVencimiento,
            'observaciones' => $extra['observaciones'] ?? ($ventaTienda->observaciones ?? $ventaTienda->nota ?? null),
            'creado_por' => (int) ($user->id ?? 0),
            'actualizado_por' => (int) ($user->id ?? 0),
        ]);
    }

    public function crearDesdeVentaRutero($venta, $user, array $extra = [])
    {
        $total = round((float) ($venta->total ?? 0), 2);

        $numeroCuotas = max(1, (int) ($extra['numero_cuotas'] ?? 1));
        $frecuenciaPago = (string) ($extra['frecuencia_pago'] ?? 'mensual');
        $primerVencimiento = $this->calcularPrimerVencimiento(
            $extra['fecha_primer_pago'] ?? null,
            $frecuenciaPago
        );

        return Cuota::create([
            'ubicacion_id' => (int) ($venta->ubicacion_id ?? 0),
            'cliente_id' => !empty($venta->cliente_id) ? (int) $venta->cliente_id : null,
            'caja_id' => !empty($venta->caja_id) ? (int) $venta->caja_id : null,
            'origen_tipo' => 'venta_rutero',
            'origen_id' => (int) $venta->id,
            'rutero_id' => !empty($venta->rutero_id) ? (int) $venta->rutero_id : null,
            'usuario_id' => !empty($venta->usuario_id) ? (int) $venta->usuario_id : (int) ($user->id ?? 0),
            'total_credito' => $total,
            'total_abonado' => 0,
            'saldo_pendiente' => $total,
            'numero_cuotas' => $numeroCuotas,
            'cuotas_pagadas' => 0,
            'frecuencia_pago' => $frecuenciaPago,
            'monto_por_cuota' => $this->calcularMontoPorCuota($total, $numeroCuotas),
            'dia_pago' => (int) $primerVencimiento->day,
            'estado' => 'pendiente',
            'fecha_inicio' => now(),
            'fecha_vencimiento' => $extra['fecha_vencimiento'] ?? null,
            'proximo_vencimiento' => $primerVencimiento,
            'observaciones' => $extra['observaciones'] ?? ($venta->observaciones ?? $venta->nota ?? null),
            'creado_por' => (int) ($user->id ?? 0),
            'actualizado_por' => (int) ($user->id ?? 0),
        ]);
    }
}