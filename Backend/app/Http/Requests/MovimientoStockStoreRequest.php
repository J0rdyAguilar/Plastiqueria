<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MovimientoStockStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $tipo = trim((string) $this->input('tipo', ''));

        $map = [
            'Entrada' => 'entrada',
            'Salida' => 'salida',
            'Traslado' => 'traslado',
            'Ajuste' => 'ajuste',

            'entrada' => 'entrada',
            'salida' => 'salida',
            'traslado' => 'traslado',
            'ajuste' => 'ajuste',

            'IN' => 'entrada',
            'OUT' => 'salida',
            'TRANSFER' => 'traslado',
            'ADJUST' => 'ajuste',
        ];

        if (isset($map[$tipo])) {
            $this->merge([
                'tipo' => $map[$tipo],
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'tipo' => 'required|string|in:entrada,salida,traslado,ajuste',
            'producto_id' => 'required|integer|exists:productos,id',
            'cantidad_base' => 'required|integer',
            'ubicacion_origen_id' => 'nullable|integer|exists:ubicaciones,id',
            'ubicacion_destino_id' => 'nullable|integer|exists:ubicaciones,id',
            'motivo' => 'nullable|string|max:255',
            'referencia_tipo' => 'nullable|string|max:50',
            'referencia_id' => 'nullable|integer',
        ];
    }

    public function messages(): array
    {
        return [
            'tipo.in' => 'Tipo inválido. Usa entrada, salida, traslado o ajuste.',
        ];
    }
}