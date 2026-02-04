<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProductoPrecioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

public function rules(): array
{
    return [
        'unidad' => ['sometimes','required'],
        'canal'  => ['sometimes'],
        'precio_sugerido_1' => ['sometimes','nullable','numeric','min:0'],
        'precio_sugerido_2' => ['sometimes','nullable','numeric','min:0'],
        'precio_sugerido_3' => ['sometimes','nullable','numeric','min:0'],
        
    ];
}

}
