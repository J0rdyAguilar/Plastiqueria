<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Usuario;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    // POST /api/v1/login
    public function login(Request $request)
    {
        $request->validate([
            'usuario' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = Usuario::where('usuario', $request->usuario)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Credenciales inválidas'], 401);
        }

        if ((int) $user->activo !== 1) {
            return response()->json(['message' => 'Usuario inactivo'], 403);
        }

        // (opcional) borrar tokens viejos para evitar que acumulen
        // $user->tokens()->delete();

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'nombre' => $user->nombre,
                'usuario' => $user->usuario,
                'telefono' => $user->telefono,
                'rol' => $user->rol,
                'activo' => (bool)$user->activo,
                'creado_en' => $user->creado_en ?? null,
                'actualizado_en' => $user->actualizado_en ?? null,
            ],
        ]);
    }

    // POST /api/v1/logout
    public function logout(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        // borra SOLO el token actual
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Sesión cerrada']);
    }

    // GET /api/v1/me
    public function me(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        return response()->json([
            'user' => [
                'id' => $user->id,
                'nombre' => $user->nombre,
                'usuario' => $user->usuario,
                'telefono' => $user->telefono,
                'rol' => $user->rol,
                'activo' => (bool)$user->activo,
                'creado_en' => $user->creado_en ?? null,
                'actualizado_en' => $user->actualizado_en ?? null,
            ],
        ]);
    }
}
