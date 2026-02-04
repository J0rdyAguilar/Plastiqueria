<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProductoImagenRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'es_principal' => ['sometimes','boolean'],
            'orden'        => ['sometimes','integer','min:0'],
        ];
    }
}
