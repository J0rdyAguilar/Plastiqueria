<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreProductoImagenRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'producto_id'  => ['required','integer','exists:productos,id'],
            'imagen'       => ['required','file','image','mimes:jpg,jpeg,png,webp','max:4096'],
            'es_principal' => ['sometimes','boolean'],
            'orden'        => ['nullable','integer','min:0'],
        ];
    }
}
