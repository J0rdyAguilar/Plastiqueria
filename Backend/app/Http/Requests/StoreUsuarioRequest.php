<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUsuarioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'ubicacion_id' => ['required', 'integer', Rule::exists('ubicaciones', 'id')],
            'nombre'       => ['required', 'string', 'max:150'],
            'usuario'      => ['required', 'string', 'max:120', 'unique:usuarios,usuario'],
            'telefono'     => ['nullable', 'string', 'max:50'],
            'password'     => ['required', 'string', 'min:6'],
            'rol'          => [
                'required',
                'string',
                Rule::in([
                    'admin',
                    'super_admin',
                    'vendedor',
                    'vendedor-tienda',
                    'caja',
                    'rutero',
                    'admin_bodega',
                ]),
            ],
            'activo'       => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'ubicacion_id.required' => 'La sucursal es obligatoria.',
            'ubicacion_id.exists'   => 'La sucursal seleccionada no existe.',
            'usuario.unique'        => 'Ese nombre de usuario ya está en uso.',
            'rol.in'                => 'El rol seleccionado no es válido.',
        ];
    }
}