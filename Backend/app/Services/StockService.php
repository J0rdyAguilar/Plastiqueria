<?php

namespace App\Services;

use App\Models\MovimientoStock;
use App\Models\ProductoPrecio;
use App\Models\Stock;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockService
{
    public function apply(array $data, int $userId): MovimientoStock
    {
        return DB::transaction(function () use ($data, $userId) {
            $tipo = $this->normalizarTipo($data['tipo'] ?? '');
            $productoId = (int) ($data['producto_id'] ?? 0);
            $presentacion = trim((string) ($data['presentacion'] ?? ''));
            $cantidad = (int) ($data['cantidad'] ?? 0);

            $origenId = isset($data['ubicacion_origen_id']) && $data['ubicacion_origen_id'] !== ''
                ? (int) $data['ubicacion_origen_id']
                : null;

            $destinoId = isset($data['ubicacion_destino_id']) && $data['ubicacion_destino_id'] !== ''
                ? (int) $data['ubicacion_destino_id']
                : null;

            if ($productoId <= 0) {
                throw ValidationException::withMessages([
                    'producto_id' => 'Producto inválido.',
                ]);
            }

            if ($presentacion === '') {
                throw ValidationException::withMessages([
                    'presentacion' => 'La presentación es obligatoria.',
                ]);
            }

            if ($cantidad <= 0) {
                throw ValidationException::withMessages([
                    'cantidad' => 'La cantidad debe ser mayor a 0.',
                ]);
            }

            $precio = ProductoPrecio::query()
                ->where('producto_id', $productoId)
                ->whereRaw('LOWER(presentacion) = ?', [mb_strtolower($presentacion)])
                ->where('activo', true)
                ->first();

            if (!$precio) {
                throw ValidationException::withMessages([
                    'presentacion' => 'La presentación seleccionada no existe para este producto.',
                ]);
            }

            $factor = (float) $precio->factor_base;

            if ($factor <= 0) {
                throw ValidationException::withMessages([
                    'presentacion' => 'La presentación tiene un factor inválido.',
                ]);
            }

            $cantidadBase = (int) round($cantidad * $factor);

            if ($tipo === 'entrada') {
                if (!$destinoId) {
                    throw ValidationException::withMessages([
                        'ubicacion_destino_id' => 'Requerido para entrada.',
                    ]);
                }

                $this->sumar($precio->id, $productoId, $destinoId, $cantidad, $cantidadBase);
            }

            if ($tipo === 'salida') {
                if (!$origenId) {
                    throw ValidationException::withMessages([
                        'ubicacion_origen_id' => 'Requerido para salida.',
                    ]);
                }

                $this->restar($precio->id, $productoId, $origenId, $cantidad, $cantidadBase);
            }

            if ($tipo === 'traslado') {
                if (!$origenId) {
                    throw ValidationException::withMessages([
                        'ubicacion_origen_id' => 'Requerido para traslado.',
                    ]);
                }

                if (!$destinoId) {
                    throw ValidationException::withMessages([
                        'ubicacion_destino_id' => 'Requerido para traslado.',
                    ]);
                }

                if ($origenId === $destinoId) {
                    throw ValidationException::withMessages([
                        'ubicacion_destino_id' => 'Origen y destino no pueden ser iguales.',
                    ]);
                }

                $this->restar($precio->id, $productoId, $origenId, $cantidad, $cantidadBase);
                $this->sumar($precio->id, $productoId, $destinoId, $cantidad, $cantidadBase);
            }

            if ($tipo === 'ajuste') {
                $target = $destinoId ?: $origenId;

                if (!$target) {
                    throw ValidationException::withMessages([
                        'ubicacion_destino_id' => 'En ajuste debes indicar una ubicación.',
                    ]);
                }

                if (trim((string) ($data['motivo'] ?? '')) === '') {
                    throw ValidationException::withMessages([
                        'motivo' => 'El motivo es obligatorio en ajuste.',
                    ]);
                }

                $this->ajustarDelta($precio->id, $productoId, $target, $cantidad, $cantidadBase);
            }

            return MovimientoStock::create([
                'tipo' => $tipo,
                'ubicacion_origen_id' => $origenId,
                'ubicacion_destino_id' => $destinoId,
                'producto_id' => $productoId,
                'producto_precio_id' => $precio->id,
                'presentacion' => $precio->presentacion,
                'factor_aplicado' => $factor,
                'cantidad' => $cantidad,
                'cantidad_base' => $cantidadBase,
                'motivo' => $data['motivo'] ?? null,
                'referencia_tipo' => $data['referencia_tipo'] ?? null,
                'referencia_id' => $data['referencia_id'] ?? null,
                'creado_por' => $userId,
                'creado_en' => now(),
            ]);
        });
    }

    private function normalizarTipo(string $tipoInput): string
    {
        $tipoIn = strtolower(trim($tipoInput));

        $map = [
            'in' => 'entrada',
            'out' => 'salida',
            'transfer' => 'traslado',
            'adjust' => 'ajuste',
            'entrada' => 'entrada',
            'salida' => 'salida',
            'traslado' => 'traslado',
            'ajuste' => 'ajuste',
        ];

        $tipo = $map[$tipoIn] ?? null;

        if (!$tipo) {
            throw ValidationException::withMessages([
                'tipo' => "Tipo inválido: '{$tipoInput}'.",
            ]);
        }

        return $tipo;
    }

    /**
     * Busca el stock existente usando la combinación más segura:
     * producto_precio_id + ubicacion_id
     * y como respaldo producto_id + ubicacion_id.
     */
    private function buscarStock(int $productoPrecioId, int $productoId, int $ubicacionId): ?Stock
    {
        $stock = Stock::query()
            ->where('producto_precio_id', $productoPrecioId)
            ->where('ubicacion_id', $ubicacionId)
            ->lockForUpdate()
            ->first();

        if ($stock) {
            return $stock;
        }

        return Stock::query()
            ->where('producto_id', $productoId)
            ->where('ubicacion_id', $ubicacionId)
            ->lockForUpdate()
            ->first();
    }

    private function sumar(int $productoPrecioId, int $productoId, int $ubicacionId, int $qty, int $qtyBase): void
    {
        $stock = $this->buscarStock($productoPrecioId, $productoId, $ubicacionId);

        if (!$stock) {
            $stock = new Stock();
            $stock->producto_id = $productoId;
            $stock->producto_precio_id = $productoPrecioId;
            $stock->ubicacion_id = $ubicacionId;
            $stock->cantidad = 0;
            $stock->cantidad_base = 0;
        } else {
            // Si encontró una fila vieja por producto_id+ubicacion_id pero sin el precio correcto,
            // la normalizamos para que quede consistente.
            $stock->producto_id = $productoId;
            $stock->producto_precio_id = $productoPrecioId;
            $stock->ubicacion_id = $ubicacionId;
        }

        $stock->cantidad = (int) $stock->cantidad + $qty;
        $stock->cantidad_base = (int) $stock->cantidad_base + $qtyBase;
        $stock->actualizado_en = now();
        $stock->save();
    }

    private function restar(int $productoPrecioId, int $productoId, int $ubicacionId, int $qty, int $qtyBase): void
    {
        $stock = $this->buscarStock($productoPrecioId, $productoId, $ubicacionId);

        if (!$stock) {
            throw ValidationException::withMessages([
                'stock' => 'No existe stock para esa presentación en esa ubicación.',
            ]);
        }

        if ((int) $stock->cantidad < $qty) {
            throw ValidationException::withMessages([
                'stock' => "Stock insuficiente. Disponible: {$stock->cantidad}.",
            ]);
        }

        $stock->cantidad = (int) $stock->cantidad - $qty;
        $stock->cantidad_base = max(0, (int) $stock->cantidad_base - $qtyBase);
        $stock->actualizado_en = now();
        $stock->save();
    }

    private function ajustarDelta(int $productoPrecioId, int $productoId, int $ubicacionId, int $qty, int $qtyBase): void
    {
        $stock = $this->buscarStock($productoPrecioId, $productoId, $ubicacionId);

        if (!$stock) {
            $stock = new Stock();
            $stock->producto_id = $productoId;
            $stock->producto_precio_id = $productoPrecioId;
            $stock->ubicacion_id = $ubicacionId;
            $stock->cantidad = 0;
            $stock->cantidad_base = 0;
        } else {
            $stock->producto_id = $productoId;
            $stock->producto_precio_id = $productoPrecioId;
            $stock->ubicacion_id = $ubicacionId;
        }

        $nuevo = (int) $stock->cantidad + $qty;
        $nuevoBase = (int) $stock->cantidad_base + $qtyBase;

        if ($nuevo < 0 || $nuevoBase < 0) {
            throw ValidationException::withMessages([
                'stock' => 'El ajuste deja stock negativo.',
            ]);
        }

        $stock->cantidad = $nuevo;
        $stock->cantidad_base = $nuevoBase;
        $stock->actualizado_en = now();
        $stock->save();
    }
}