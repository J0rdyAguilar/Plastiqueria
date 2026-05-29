<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (int) $this->id,
            'sku' => $this->sku,
            'nombre' => $this->nombre,
            'descripcion' => $this->descripcion,
            'unidad_base' => $this->unidad_base,
            'activo' => (bool) $this->activo,
            'creado_en' => optional($this->creado_en)->format('Y-m-d H:i:s'),
            'actualizado_en' => optional($this->actualizado_en)->format('Y-m-d H:i:s'),

            'imagen_principal' => $this->whenLoaded('imagenPrincipal', function () {
                return $this->imagenPrincipal ? [
                    'id' => (int) $this->imagenPrincipal->id,
                    'producto_id' => (int) $this->imagenPrincipal->producto_id,
                    'url' => $this->imagenPrincipal->url,
                    'es_principal' => (bool) $this->imagenPrincipal->es_principal,
                    'orden' => (int) ($this->imagenPrincipal->orden ?? 0),
                ] : null;
            }),

            'imagenes' => $this->whenLoaded('imagenes', function () {
                return $this->imagenes->map(function ($img) {
                    return [
                        'id' => (int) $img->id,
                        'producto_id' => (int) $img->producto_id,
                        'url' => $img->url,
                        'es_principal' => (bool) $img->es_principal,
                        'orden' => (int) ($img->orden ?? 0),
                    ];
                })->values();
            }),

            'precios' => $this->whenLoaded('precios', function () {
                return $this->precios->map(function ($p) {
                    return [
                        'id' => (int) $p->id,
                        'producto_id' => (int) $p->producto_id,
                        'presentacion' => $p->presentacion,
                        'factor_base' => (float) ($p->factor_base ?? 1),
                        'precio_costo' => (float) ($p->precio_costo ?? 0),
                        'precio_venta' => (float) ($p->precio_venta ?? 0),
                        'precio_ruta' => (float) ($p->precio_ruta ?? $p->precio_venta ?? 0),
                        'activo' => (bool) $p->activo,
                        'creado_en' => optional($p->creado_en)->format('Y-m-d H:i:s'),
                        'actualizado_en' => optional($p->actualizado_en)->format('Y-m-d H:i:s'),
                    ];
                })->values();
            }),
        ];
    }
}
