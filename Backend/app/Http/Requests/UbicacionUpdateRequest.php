<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UbicacionUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nombre'    => ['sometimes', 'required', 'string', 'max:160'],
            'tipo'      => ['sometimes', 'required', 'in:bodega,tienda'], // si agregas ruta: 'in:bodega,tienda,ruta'
            'direccion' => ['sometimes', 'nullable', 'string', 'max:255'],
            'activa'    => ['sometimes', 'boolean'],
        ];
    }
}
