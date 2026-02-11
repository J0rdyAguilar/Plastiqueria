<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UbicacionStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Si ya manejas roles con middleware, aquí puede ser true.
        return true;
    }

    public function rules(): array
    {
        return [
            'nombre'    => ['required', 'string', 'max:160'],
            'tipo'      => ['required', 'in:bodega,tienda'], // si agregas ruta: 'in:bodega,tienda,ruta'
            'direccion' => ['nullable', 'string', 'max:255'],
            'activa'    => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'nombre.required' => 'El nombre es obligatorio.',
            'tipo.required'   => 'El tipo es obligatorio.',
            'tipo.in'         => 'El tipo debe ser bodega o tienda.',
        ];
    }
}
