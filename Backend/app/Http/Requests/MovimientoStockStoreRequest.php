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
        return [
            'tipo' => [
                'required',
                'string',
                Rule::in([
                    'entrada',
                    'salida',
                    'traslado',
                    'ajuste',
                    'IN',
                    'OUT',
                    'TRANSFER',
                    'ADJUST',
                    'in',
                    'out',
                    'transfer',
                    'adjust',
                ]),
            ],

            'producto_id' => [
                'required',
                'integer',
                'exists:productos,id',
            ],

            'presentacion' => [
                'required',
                'string',
                'max:50',
            ],

            'cantidad' => [
                'required',
                'integer',
                'min:1',
            ],

            'ubicacion_origen_id' => [
                'nullable',
                'integer',
                'exists:ubicaciones,id',
            ],

            'ubicacion_destino_id' => [
                'nullable',
                'integer',
                'exists:ubicaciones,id',
            ],

            'motivo' => [
                'nullable',
                'string',
                'max:255',
            ],

            'referencia_tipo' => [
                'nullable',
                'string',
                'max:50',
            ],

            'referencia_id' => [
                'nullable',
                'integer',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'tipo.required' => 'El tipo es obligatorio.',
            'tipo.in' => 'Tipo inválido.',
            'producto_id.required' => 'El producto es obligatorio.',
            'producto_id.exists' => 'El producto seleccionado no existe.',
            'presentacion.required' => 'La presentación es obligatoria.',
            'cantidad.required' => 'La cantidad es obligatoria.',
            'cantidad.integer' => 'La cantidad debe ser un número entero.',
            'cantidad.min' => 'La cantidad debe ser mayor a 0.',
            'ubicacion_origen_id.exists' => 'La ubicación origen no existe.',
            'ubicacion_destino_id.exists' => 'La ubicación destino no existe.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'tipo' => is_string($this->tipo) ? trim($this->tipo) : $this->tipo,
            'presentacion' => is_string($this->presentacion) ? trim($this->presentacion) : $this->presentacion,

            'producto_id' => $this->producto_id !== null && $this->producto_id !== ''
                ? (int) $this->producto_id
                : null,

            'cantidad' => $this->cantidad !== null && $this->cantidad !== ''
                ? (int) $this->cantidad
                : null,

            'ubicacion_origen_id' => $this->ubicacion_origen_id !== null && $this->ubicacion_origen_id !== ''
                ? (int) $this->ubicacion_origen_id
                : null,

            'ubicacion_destino_id' => $this->ubicacion_destino_id !== null && $this->ubicacion_destino_id !== ''
                ? (int) $this->ubicacion_destino_id
                : null,
        ]);
    }
}