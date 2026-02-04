<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreProductoUnidadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // luego lo amarramos a roles si quieres
    }

    public function rules(): array
    {
        return [
            'producto_id'       => ['required','integer','exists:productos,id'],
            'unidad'            => ['required','string','max:50'],
            'etiqueta'          => ['nullable','string','max:100'],
            'factor_base'       => ['required','integer','min:1'],
            'es_predeterminada' => ['boolean'],
        ];
    }
}
