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
        $id = $this->route('usuario')?->id; // Route Model Binding

        return [
            'nombre'   => ['sometimes', 'required', 'string', 'max:150'],
            'usuario'  => ['sometimes', 'required', 'string', 'max:120', Rule::unique('usuarios', 'usuario')->ignore($id)],
            'telefono' => ['sometimes', 'nullable', 'string', 'max:50'],
            'password' => ['sometimes', 'nullable', 'string', 'min:6', 'max:255'], // opcional
            'rol'      => ['sometimes', 'required', Rule::in(['super_admin', 'admin', 'vendedor', 'caja'])],
            'activo'   => ['sometimes', 'nullable', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('activo')) {
            $this->merge([
                'activo' => filter_var($this->input('activo'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE),
            ]);
        }
    }
}
