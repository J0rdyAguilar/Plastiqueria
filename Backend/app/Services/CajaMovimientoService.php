<?php

namespace App\Services;

use App\Models\Caja;
use App\Models\MovimientoCaja;

class CajaMovimientoService
{
    public function cajaAbiertaPorUbicacion(?int $ubicacionId): ?Caja
    {
        if (!$ubicacionId) {
            return null;
        }

        return Caja::query()
            ->where('ubicacion_id', (int) $ubicacionId)
            ->whereNull('cerrado_en')
            ->latest('id')
            ->first();
    }

    public function registrar(array $data): ?MovimientoCaja
    {
        $ubicacionId = !empty($data['ubicacion_id']) ? (int) $data['ubicacion_id'] : null;
        $caja = $this->cajaAbiertaPorUbicacion($ubicacionId);

        if (!$caja) {
            return null;
        }

        return MovimientoCaja::create([
            'caja_id' => (int) $caja->id,
            'tipo' => $data['tipo'],
            'concepto' => $data['concepto'] ?? null,
            'monto' => round((float) ($data['monto'] ?? 0), 2),
            'metodo_pago' => $data['metodo_pago'] ?? null,
            'referencia_tipo' => $data['referencia_tipo'] ?? null,
            'referencia_id' => !empty($data['referencia_id']) ? (int) $data['referencia_id'] : null,
            'notas' => $data['notas'] ?? null,
            'creado_en' => now(),
        ]);
    }

    public function ingreso(
        ?int $ubicacionId,
        float $monto,
        string $concepto,
        ?string $metodoPago = null,
        ?string $referenciaTipo = null,
        ?int $referenciaId = null,
        ?string $notas = null
    ): ?MovimientoCaja {
        return $this->registrar([
            'ubicacion_id' => $ubicacionId,
            'tipo' => 'ingreso',
            'concepto' => $concepto,
            'monto' => $monto,
            'metodo_pago' => $metodoPago,
            'referencia_tipo' => $referenciaTipo,
            'referencia_id' => $referenciaId,
            'notas' => $notas,
        ]);
    }

    public function egreso(
        ?int $ubicacionId,
        float $monto,
        string $concepto,
        ?string $metodoPago = null,
        ?string $referenciaTipo = null,
        ?int $referenciaId = null,
        ?string $notas = null
    ): ?MovimientoCaja {
        return $this->registrar([
            'ubicacion_id' => $ubicacionId,
            'tipo' => 'egreso',
            'concepto' => $concepto,
            'monto' => $monto,
            'metodo_pago' => $metodoPago,
            'referencia_tipo' => $referenciaTipo,
            'referencia_id' => $referenciaId,
            'notas' => $notas,
        ]);
    }
}