<?php

namespace App\Services;

use App\Models\MovimientoStock;
use App\Models\Stock;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockService
{
    /**
     * Acepta tipo en:
     * - IN / OUT / TRANSFER / ADJUST
     * - entrada / salida / traslado / ajuste (ENUM real)
     *
     * Guarda SIEMPRE en BD: entrada/salida/traslado/ajuste
     */
    public function apply(array $data, int $userId): MovimientoStock
    {
        return DB::transaction(function () use ($data, $userId) {

            // =========================
            // 1) NORMALIZAR TIPO
            // =========================
            $tipoIn = strtolower(trim((string)($data['tipo'] ?? '')));

            $map = [
                'in'       => 'entrada',
                'out'      => 'salida',
                'transfer' => 'traslado',
                'adjust'   => 'ajuste',
                'entrada'  => 'entrada',
                'salida'   => 'salida',
                'traslado' => 'traslado',
                'ajuste'   => 'ajuste',
            ];

            $tipo = $map[$tipoIn] ?? null;

            if (!$tipo) {
                throw ValidationException::withMessages([
                    'tipo' => "Tipo inválido: '{$data['tipo']}'. Usa IN/OUT/TRANSFER/ADJUST o entrada/salida/traslado/ajuste."
                ]);
            }

            // =========================
            // 2) DATOS BASE
            // =========================
            $productoId = (int)($data['producto_id'] ?? 0);
            $qty        = (int)($data['cantidad_base'] ?? 0);

            $origenId  = isset($data['ubicacion_origen_id']) ? (int)$data['ubicacion_origen_id'] : null;
            $destinoId = isset($data['ubicacion_destino_id']) ? (int)$data['ubicacion_destino_id'] : null;

            if ($productoId <= 0) {
                throw ValidationException::withMessages(['producto_id' => 'producto_id inválido']);
            }

            // =========================
            // 3) VALIDACIONES POR TIPO
            // =========================
            if ($tipo !== 'ajuste' && $qty <= 0) {
                throw ValidationException::withMessages(['cantidad_base' => 'La cantidad debe ser mayor a 0.']);
            }

            if ($tipo === 'entrada') {
                if (!$destinoId) {
                    throw ValidationException::withMessages(['ubicacion_destino_id' => 'Requerido para entrada.']);
                }
            }

            if ($tipo === 'salida') {
                if (!$origenId) {
                    throw ValidationException::withMessages(['ubicacion_origen_id' => 'Requerido para salida.']);
                }
            }

            if ($tipo === 'traslado') {
                if (!$origenId) {
                    throw ValidationException::withMessages(['ubicacion_origen_id' => 'Requerido para traslado.']);
                }
                if (!$destinoId) {
                    throw ValidationException::withMessages(['ubicacion_destino_id' => 'Requerido para traslado.']);
                }
                if ($origenId === $destinoId) {
                    throw ValidationException::withMessages(['ubicacion_destino_id' => 'Origen y destino no pueden ser iguales.']);
                }
            }

            if ($tipo === 'ajuste') {
                // ajuste permite delta positivo o negativo
                if ($qty === 0) {
                    throw ValidationException::withMessages(['cantidad_base' => 'En ajuste la cantidad no puede ser 0 (usa + o -).']);
                }
                if (!$destinoId && !$origenId) {
                    throw ValidationException::withMessages(['ubicacion_destino_id' => 'En ajuste envía ubicacion_destino_id (o ubicacion_origen_id).']);
                }
            }

            // =========================
            // 4) CREAR MOVIMIENTO (TIPO ENUM REAL)
            // =========================
            $mov = MovimientoStock::create([
                'tipo' => $tipo, // <- IMPORTANTÍSIMO: SIEMPRE enum real
                'ubicacion_origen_id' => $origenId,
                'ubicacion_destino_id' => $destinoId,
                'producto_id' => $productoId,
                'cantidad_base' => $qty,
                'motivo' => $data['motivo'] ?? null,
                'referencia_tipo' => $data['referencia_tipo'] ?? null,
                'referencia_id' => $data['referencia_id'] ?? null,
                'creado_por' => $userId,
                'creado_en' => now(),
            ]);

            // =========================
            // 5) APLICAR IMPACTO A STOCK
            // =========================
            if ($tipo === 'entrada') {
                $this->sumar($productoId, $destinoId, $qty);
            } elseif ($tipo === 'salida') {
                $this->restar($productoId, $origenId, $qty);
            } elseif ($tipo === 'traslado') {
                $this->restar($productoId, $origenId, $qty);
                $this->sumar($productoId, $destinoId, $qty);
            } elseif ($tipo === 'ajuste') {
                $target = $destinoId ?: $origenId;
                $this->ajustarDelta($productoId, $target, $qty); // qty puede ser + o -
            }

            return $mov;
        });
    }

    private function sumar(int $productoId, int $ubicacionId, int $qty): void
    {
        $stock = Stock::query()
            ->where('producto_id', $productoId)
            ->where('ubicacion_id', $ubicacionId)
            ->lockForUpdate()
            ->first();

        if (!$stock) {
            $stock = Stock::create([
                'producto_id' => $productoId,
                'ubicacion_id' => $ubicacionId,
                'cantidad_base' => 0,
            ]);
        }

        $stock->cantidad_base = (int)$stock->cantidad_base + $qty;
        $stock->actualizado_en = now();
        $stock->save();
    }

    private function restar(int $productoId, int $ubicacionId, int $qty): void
    {
        $stock = Stock::query()
            ->where('producto_id', $productoId)
            ->where('ubicacion_id', $ubicacionId)
            ->lockForUpdate()
            ->first();

        if (!$stock) {
            throw ValidationException::withMessages([
                'stock' => "No existe stock para producto {$productoId} en ubicación {$ubicacionId}."
            ]);
        }

        if ((int)$stock->cantidad_base < $qty) {
            throw ValidationException::withMessages([
                'stock' => "Stock insuficiente. Disponible: {$stock->cantidad_base}, requerido: {$qty}."
            ]);
        }

        $stock->cantidad_base = (int)$stock->cantidad_base - $qty;
        $stock->actualizado_en = now();
        $stock->save();
    }

    private function ajustarDelta(int $productoId, int $ubicacionId, int $delta): void
    {
        $stock = Stock::query()
            ->where('producto_id', $productoId)
            ->where('ubicacion_id', $ubicacionId)
            ->lockForUpdate()
            ->first();

        if (!$stock) {
            $stock = Stock::create([
                'producto_id' => $productoId,
                'ubicacion_id' => $ubicacionId,
                'cantidad_base' => 0,
            ]);
        }

        $nuevo = (int)$stock->cantidad_base + $delta;

        if ($nuevo < 0) {
            throw ValidationException::withMessages([
                'stock' => "El ajuste deja stock negativo. Actual: {$stock->cantidad_base}, delta: {$delta}."
            ]);
        }

        $stock->cantidad_base = $nuevo;
        $stock->actualizado_en = now();
        $stock->save();
    }
}
