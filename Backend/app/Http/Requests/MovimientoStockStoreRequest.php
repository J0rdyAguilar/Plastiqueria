<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MovimientoStockStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // luego si quieres, aquí pones roles
    }

    public function rules(): array
    {
        return [
            'tipo' => 'required|string|in:IN,OUT,TRANSFER,ADJUST',
            'producto_id' => 'required|integer|exists:productos,id',
            'cantidad_base' => 'required|integer', // en ADJUST puede ser negativo

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
            'tipo.in' => 'Tipo inválido. Usa IN, OUT, TRANSFER o ADJUST.',
        ];
    }
}
