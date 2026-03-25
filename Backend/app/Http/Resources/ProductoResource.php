<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductoResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'sku' => $this->sku,
            'nombre' => $this->nombre,
            'descripcion' => $this->descripcion,
            'unidad_base' => $this->unidad_base,
            'alerta_stock' => $this->alerta_stock,
            'activo' => (bool) $this->activo,

            'imagen_principal' => $this->whenLoaded('imagenPrincipal', function () {
                return $this->imagenPrincipal ? [
                    'id' => $this->imagenPrincipal->id,
                    'url' => $this->imagenPrincipal->url,
                ] : null;
            }),

            'precios' => $this->whenLoaded('precios', function () {
                return $this->precios
                    ->sortBy('presentacion')
                    ->values()
                    ->map(function ($precio) {
                        return [
                            'id' => $precio->id,
                            'presentacion' => $precio->presentacion,
                            'factor_base' => (float) $precio->factor_base,
                            'precio' => (float) $precio->precio,
                            'activo' => (bool) $precio->activo,
                        ];
                    });
            }, []),

            'stocks' => $this->whenLoaded('stocks', function () {
                return $this->stocks->values()->map(function ($stock) {
                    return [
                        'id' => $stock->id,
                        'ubicacion_id' => $stock->ubicacion_id,
                        'producto_id' => $stock->producto_id,
                        'cantidad_base' => (int) $stock->cantidad_base,
                        'actualizado_en' => $stock->actualizado_en,
                    ];
                });
            }, []),
        ];
    }
}