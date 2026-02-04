<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProductoUnidadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'unidad'            => ['sometimes','required','string','max:50'],
            'etiqueta'          => ['sometimes','nullable','string','max:100'],
            'factor_base'       => ['sometimes','required','integer','min:1'],
            'es_predeterminada' => ['sometimes','boolean'],
        ];
    }
}
