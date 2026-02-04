<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreProductoPrecioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

public function rules(): array
{
    return [
        'producto_id' => ['required','exists:productos,id'],
        'unidad'      => ['required'],
        'canal'       => ['nullable'],
        'precio_sugerido_1' => ['nullable','numeric','min:0'],
        'precio_sugerido_2' => ['nullable','numeric','min:0'],
        'precio_sugerido_3' => ['nullable','numeric','min:0'],
    ];
}

}
