<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MovimientoStockStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $tipo = $this->input('tipo');

        $rules = [
            'tipo' => ['required', Rule::in(['entrada', 'salida', 'traslado', 'ajuste'])],

            'producto_id' => ['required', 'integer', 'exists:productos,id'],

            // por defecto los dejamos nullable y validamos según tipo
            'ubicacion_origen_id'  => ['nullable', 'integer', 'exists:ubicaciones,id'],
            'ubicacion_destino_id' => ['nullable', 'integer', 'exists:ubicaciones,id'],

            'motivo' => ['nullable', 'string', 'max:255'],

            'referencia_tipo' => ['nullable', 'string', 'max:50'],
            'referencia_id'   => ['nullable', 'integer'],
        ];

        // Reglas según tipo
        if ($tipo === 'entrada') {
            $rules['ubicacion_destino_id'][] = 'required';
            $rules['cantidad_base'] = ['required', 'integer', 'min:1'];
        } elseif ($tipo === 'salida') {
            $rules['ubicacion_origen_id'][] = 'required';
            $rules['cantidad_base'] = ['required', 'integer', 'min:1'];
        } elseif ($tipo === 'traslado') {
            $rules['ubicacion_origen_id'][] = 'required';
            $rules['ubicacion_destino_id'][] = 'required';
            $rules['cantidad_base'] = ['required', 'integer', 'min:1'];
        } elseif ($tipo === 'ajuste') {
            // ajuste como delta (+ o -), no puede ser 0
            $rules['ubicacion_origen_id'][] = 'required';
            $rules['cantidad_base'] = ['required', 'integer', 'not_in:0'];
            $rules['motivo'][] = 'required';
        } else {
            // si no viene tipo aún, valida cantidad base genérica
            $rules['cantidad_base'] = ['required', 'integer'];
        }

        return $rules;
    }

    public function messages(): array
    {
        return [
            'cantidad_base.not_in' => 'El ajuste no puede ser 0.',
            'motivo.required'      => 'El motivo es obligatorio para ajustes.',
        ];
    }
}
