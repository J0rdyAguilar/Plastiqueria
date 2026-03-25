<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UsuarioResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'ubicacion_id'   => $this->ubicacion_id,
            'nombre'         => $this->nombre,
            'usuario'        => $this->usuario,
            'telefono'       => $this->telefono,
            'rol'            => $this->rol,
            'activo'         => (bool) $this->activo,
            'creado_en'      => $this->creado_en,
            'actualizado_en' => $this->actualizado_en,

            'ubicacion' => $this->whenLoaded('ubicacion', function () {
                return [
                    'id'        => $this->ubicacion->id,
                    'nombre'    => $this->ubicacion->nombre,
                    'tipo'      => $this->ubicacion->tipo,
                    'direccion' => $this->ubicacion->direccion,
                    'activa'    => (bool) $this->ubicacion->activa,
                ];
            }),
        ];
    }
}