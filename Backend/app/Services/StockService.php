<?php

namespace App\Services;

use App\Models\MovimientoStock;
use App\Models\Stock;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class StockService
{
    /**
     * Aplica un movimiento y actualiza stock con transacción y locks.
     *
     * @return MovimientoStock
     */
    public function apply(array $data, int $userId): MovimientoStock
    {
        return DB::transaction(function () use ($data, $userId) {
            $tipo = $data['tipo'];
            $productoId = (int)$data['producto_id'];
            $cantidad = (int)$data['cantidad_base'];

            $origenId  = isset($data['ubicacion_origen_id']) ? (int)$data['ubicacion_origen_id'] : null;
            $destinoId = isset($data['ubicacion_destino_id']) ? (int)$data['ubicacion_destino_id'] : null;

            // 1) Inserta movimiento
            $mov = MovimientoStock::create([
                'tipo' => $tipo,
                'ubicacion_origen_id' => $origenId,
                'ubicacion_destino_id' => $destinoId,
                'producto_id' => $productoId,
                'cantidad_base' => $cantidad,
                'motivo' => $data['motivo'] ?? null,
                'referencia_tipo' => $data['referencia_tipo'] ?? null,
                'referencia_id' => $data['referencia_id'] ?? null,
                'creado_por' => $userId,
            ]);

            // 2) Aplica stock según tipo
            if ($tipo === 'entrada') {
                $this->inc($destinoId, $productoId, $cantidad);
            }

            if ($tipo === 'salida') {
                $this->dec($origenId, $productoId, $cantidad);
            }

            if ($tipo === 'traslado') {
                if ($origenId === $destinoId) {
                    throw new RuntimeException('Origen y destino no pueden ser la misma ubicación.');
                }
                $this->dec($origenId, $productoId, $cantidad);
                $this->inc($destinoId, $productoId, $cantidad);
            }

            if ($tipo === 'ajuste') {
                // ajuste es delta (+ o -)
                if ($cantidad > 0) $this->inc($origenId, $productoId, $cantidad);
                if ($cantidad < 0) $this->dec($origenId, $productoId, abs($cantidad));
            }

            return $mov->fresh();
        });
    }

    private function inc(int $ubicacionId, int $productoId, int $cantidad): void
    {
        $row = Stock::where('ubicacion_id', $ubicacionId)
            ->where('producto_id', $productoId)
            ->lockForUpdate()
            ->first();

        if (!$row) {
            $row = Stock::create([
                'ubicacion_id' => $ubicacionId,
                'producto_id' => $productoId,
                'cantidad_base' => 0,
            ]);
            // lock row recién creado
            $row = Stock::where('id', $row->id)->lockForUpdate()->first();
        }

        $row->cantidad_base += $cantidad;
        $row->save();
    }

    private function dec(int $ubicacionId, int $productoId, int $cantidad): void
    {
        $row = Stock::where('ubicacion_id', $ubicacionId)
            ->where('producto_id', $productoId)
            ->lockForUpdate()
            ->first();

        if (!$row) {
            throw new RuntimeException('No hay stock registrado para este producto en la ubicación.');
        }

        if (($row->cantidad_base - $cantidad) < 0) {
            throw new RuntimeException('Stock insuficiente para realizar la salida/traslado.');
        }

        $row->cantidad_base -= $cantidad;
        $row->save();
    }
}
