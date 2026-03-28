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
        $tipo = strtolower((string) $this->input('tipo'));

        $rules = [
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

            'motivo' => [
                $tipo === 'ajuste' ? 'required' : 'nullable',
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

        if ($tipo === 'entrada' || $tipo === 'in') {
            $rules['ubicacion_destino_id'] = [
                'nullable',
                'integer',
                'exists:ubicaciones,id',
            ];
        }

        if (
            $tipo === 'salida' || $tipo === 'out' ||
            $tipo === 'ajuste' || $tipo === 'adjust'
        ) {
            $rules['ubicacion_origen_id'] = [
                'nullable',
                'integer',
                'exists:ubicaciones,id',
            ];
        }

        if ($tipo === 'traslado' || $tipo === 'transfer') {
            $rules['ubicacion_origen_id'] = [
                'nullable',
                'integer',
                'exists:ubicaciones,id',
            ];

            $rules['ubicacion_destino_id'] = [
                'required',
                'integer',
                'exists:ubicaciones,id',
                'different:ubicacion_origen_id',
            ];
        }

        return $rules;
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
            'ubicacion_destino_id.required' => 'La ubicación destino es obligatoria para traslados.',
            'ubicacion_destino_id.different' => 'La ubicación destino debe ser distinta a la ubicación origen.',

            'motivo.required' => 'El motivo es obligatorio en ajustes.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $tipo = is_string($this->tipo) ? trim($this->tipo) : $this->tipo;

        $map = [
            'IN' => 'entrada',
            'in' => 'entrada',
            'OUT' => 'salida',
            'out' => 'salida',
            'TRANSFER' => 'traslado',
            'transfer' => 'traslado',
            'ADJUST' => 'ajuste',
            'adjust' => 'ajuste',
        ];

        if (is_string($tipo) && array_key_exists($tipo, $map)) {
            $tipo = $map[$tipo];
        }

        $this->merge([
            'tipo' => $tipo,
            'presentacion' => is_string($this->presentacion) ? trim($this->presentacion) : $this->presentacion,
            'motivo' => is_string($this->motivo) ? trim($this->motivo) : $this->motivo,
            'referencia_tipo' => is_string($this->referencia_tipo) ? trim($this->referencia_tipo) : $this->referencia_tipo,

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

            'referencia_id' => $this->referencia_id !== null && $this->referencia_id !== ''
                ? (int) $this->referencia_id
                : null,
        ]);
    }
}