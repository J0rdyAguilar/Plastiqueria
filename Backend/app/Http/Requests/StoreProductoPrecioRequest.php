<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreProductoPrecioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'producto_id'   => ['required', 'integer', 'exists:productos,id'],
            'presentacion'  => ['required', 'string', 'max:50'],
            'factor_base'   => ['required', 'numeric', 'min:0.0001'],
            'precio_costo'  => ['required', 'numeric', 'min:0'],
            'precio_venta'  => ['required', 'numeric', 'min:0'],
            'activo'        => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'producto_id.required'  => 'El producto es obligatorio.',
            'producto_id.integer'   => 'El producto no es válido.',
            'producto_id.exists'    => 'El producto no existe.',

            'presentacion.required' => 'La presentación es obligatoria.',
            'presentacion.string'   => 'La presentación debe ser texto.',
            'presentacion.max'      => 'La presentación no puede tener más de 50 caracteres.',

            'factor_base.required'  => 'El factor base es obligatorio.',
            'factor_base.numeric'   => 'El factor base debe ser numérico.',
            'factor_base.min'       => 'El factor base debe ser mayor que 0.',

            'precio_costo.required' => 'El precio costo es obligatorio.',
            'precio_costo.numeric'  => 'El precio costo debe ser numérico.',
            'precio_costo.min'      => 'El precio costo no puede ser negativo.',

            'precio_venta.required' => 'El precio venta es obligatorio.',
            'precio_venta.numeric'  => 'El precio venta debe ser numérico.',
            'precio_venta.min'      => 'El precio venta no puede ser negativo.',

            'activo.boolean'        => 'El estado activo debe ser verdadero o falso.',
        ];
    }
}