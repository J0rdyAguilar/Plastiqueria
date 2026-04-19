<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'sku' => $this->sku,
            'nombre' => $this->nombre,
            'descripcion' => $this->descripcion,
            'unidad_base' => $this->unidad_base,
            'activo' => (bool) $this->activo,

            'imagen_principal' => $this->whenLoaded('imagenPrincipal', function () {
                if (!$this->imagenPrincipal) {
                    return null;
                }

                $url = (string) ($this->imagenPrincipal->url ?? '');

                if (
                    $url &&
                    !str_starts_with($url, 'http://') &&
                    !str_starts_with($url, 'https://')
                ) {
                    $url = asset($url);
                }

                return [
                    'id' => $this->imagenPrincipal->id,
                    'url' => $url,
                    'es_principal' => (bool) ($this->imagenPrincipal->es_principal ?? true),
                    'orden' => (int) ($this->imagenPrincipal->orden ?? 0),
                ];
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
                            'precio_costo' => (float) $precio->precio_costo,
                            'precio_venta' => (float) $precio->precio_venta,
                            'activo' => (bool) $precio->activo,
                        ];
                    });
            }, []),
        ];
    }
}