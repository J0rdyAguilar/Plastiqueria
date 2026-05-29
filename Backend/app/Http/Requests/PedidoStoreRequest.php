<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PedidoStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'codigo' => ['nullable', 'string', 'max:60'],
            'ubicacion_id' => ['nullable', 'integer', 'exists:ubicaciones,id'],
            'cliente_id' => ['required', 'integer', 'exists:clientes,id'],
            'vendedor_id' => ['nullable', 'integer', 'exists:vendedores,id'],
            'ruta_id' => ['nullable', 'integer', 'exists:rutas,id'],
            'zona_id' => ['nullable', 'integer', 'exists:zonas,id'],
            'fecha_pedido' => ['nullable', 'date'],
            'observaciones' => ['nullable', 'string'],
            'total' => ['nullable', 'numeric', 'min:0'],
            'canal' => ['nullable', Rule::in(['ruta', 'pos'])],

            'detalles' => ['required', 'array', 'min:1'],
            'detalles.*.producto_id' => ['required', 'integer', 'exists:productos,id'],
            'detalles.*.presentacion' => ['required', 'string', 'max:50'],
            'detalles.*.cantidad' => ['required', 'numeric', 'min:0.01'],
            'detalles.*.cantidad_base' => ['required', 'integer', 'min:1'],
            'detalles.*.precio_unitario' => ['required', 'numeric', 'min:0'],
            'detalles.*.subtotal' => ['nullable', 'numeric', 'min:0'],
            'detalles.*.es_monto_variable' => ['nullable', Rule::in([0, 1, '0', '1', true, false])],
        ];
    }
}