<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreProductoUnidadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'producto_id'       => ['required', 'integer', 'exists:productos,id'],
            'presentacion'      => ['required', 'string', 'max:50'],
            'etiqueta'          => ['nullable', 'string', 'max:100'],
            'factor_base'       => ['required', 'numeric', 'min:1'],
            'es_predeterminada' => ['nullable', 'boolean'],
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

            'etiqueta.string'       => 'La etiqueta debe ser texto.',
            'etiqueta.max'          => 'La etiqueta no puede tener más de 100 caracteres.',

            'factor_base.required'  => 'El factor base es obligatorio.',
            'factor_base.numeric'   => 'El factor base debe ser numérico.',
            'factor_base.min'       => 'El factor base debe ser mayor o igual a 1.',

            'es_predeterminada.boolean' => 'El campo predeterminado debe ser verdadero o falso.',
        ];
    }
}