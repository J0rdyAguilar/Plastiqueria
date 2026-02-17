<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PedidoStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // luego ponemos roles
    }

    public function rules(): array
    {
        return [
            'codigo' => 'nullable|string|max:60',
            'cliente_id' => 'required|integer|exists:clientes,id',
            'fecha_pedido' => 'nullable|date',
            'notas' => 'nullable|string',
            'canal' => 'nullable|in:ruta,pos',

            'detalles' => 'required|array|min:1',
            'detalles.*.producto_id' => 'required|integer|exists:productos,id',
            'detalles.*.unidad' => 'required|string|in:unidad,docena,paquete,caja,bolsa,fardo,millar,cubeta',
            'detalles.*.cantidad' => 'required|integer|min:1',
            'detalles.*.cantidad_base' => 'nullable|integer|min:1',
        ];
    }
}
