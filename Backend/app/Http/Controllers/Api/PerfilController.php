<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\Password;

class PerfilController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user()->load('sucursal');

        return response()->json([
            'user' => $this->mapUser($user),
        ]);
    }

    public function update(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'correo' => ['required', 'email', 'max:255', 'unique:users,correo,' . $user->id],
            'telefono' => ['nullable', 'string', 'max:30'],
            'direccion' => ['nullable', 'string', 'max:255'],
            'bio' => ['nullable', 'string', 'max:1000'],
            'foto' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        $user->nombre = $data['nombre'];
        $user->correo = $data['correo'];
        $user->telefono = $data['telefono'] ?? null;
        $user->direccion = $data['direccion'] ?? null;
        $user->bio = $data['bio'] ?? null;

        if ($request->hasFile('foto')) {
            if ($user->foto && Storage::disk('public')->exists($user->foto)) {
                Storage::disk('public')->delete($user->foto);
            }

            $path = $request->file('foto')->store('perfiles', 'public');
            $user->foto = $path;
        }

        $user->save();
        $user->load('sucursal');

        return response()->json([
            'message' => 'Perfil actualizado correctamente.',
            'user' => $this->mapUser($user),
        ]);
    }

    public function changePassword(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'password_actual' => ['required', 'string'],
            'password_nueva' => ['required', 'string', 'confirmed', Password::min(8)],
        ], [
            'password_nueva.confirmed' => 'La confirmación de contraseña no coincide.',
        ]);

        if (!Hash::check($data['password_actual'], $user->password)) {
            return response()->json([
                'message' => 'La contraseña actual es incorrecta.',
            ], 422);
        }

        $user->password = Hash::make($data['password_nueva']);
        $user->save();

        return response()->json([
            'message' => 'Contraseña actualizada correctamente.',
        ]);
    }

    private function mapUser($user): array
    {
        return [
            'id' => $user->id,
            'nombre' => $user->nombre,
            'correo' => $user->correo,
            'telefono' => $user->telefono,
            'direccion' => $user->direccion,
            'bio' => $user->bio,
            'rol' => $user->rol ?? $user->role,
            'sucursal' => $user->sucursal ? [
                'id' => $user->sucursal->id,
                'nombre' => $user->sucursal->nombre,
            ] : null,
            'foto' => $user->foto,
            'foto_url' => $user->foto ? asset('storage/' . $user->foto) : null,
        ];
    }
}