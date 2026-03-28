<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUsuarioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $usuarioId = $this->route('usuario')->id ?? null;

        return [
            'ubicacion_id' => ['sometimes', 'required', 'integer', Rule::exists('ubicaciones', 'id')],
            'nombre'       => ['sometimes', 'required', 'string', 'max:150'],
            'usuario'      => [
                'sometimes',
                'required',
                'string',
                'max:120',
                Rule::unique('usuarios', 'usuario')->ignore($usuarioId),
            ],
            'telefono'     => ['nullable', 'string', 'max:50'],
            'password'     => ['nullable', 'string', 'min:6'],
            'rol'          => [
                'sometimes',
                'required',
                'string',
                Rule::in([
                    'admin',
                    'super_admin',
                    'vendedor',
                    'vendedor-tienda',
                    'caja',
                    'rutero',
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