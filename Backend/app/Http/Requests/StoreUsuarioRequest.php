<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUsuarioRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Permitir (luego si quieres, aquí validamos rol admin/super_admin)
        return true;
    }

    public function rules(): array
    {
        return [
            'nombre'   => ['required', 'string', 'max:150'],
            'usuario'  => ['required', 'string', 'max:120', 'unique:usuarios,usuario'],
            'telefono' => ['nullable', 'string', 'max:50'],
            'password' => ['required', 'string', 'min:6', 'max:255'],
            'rol'      => ['required', Rule::in(['super_admin', 'admin', 'vendedor', 'cajero'])],
            'activo'   => ['nullable', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        // Por si te llega activo como 1/0 o true/false
        if ($this->has('activo')) {
            $this->merge([
                'activo' => filter_var($this->input('activo'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE),
            ]);
        }
    }
}
