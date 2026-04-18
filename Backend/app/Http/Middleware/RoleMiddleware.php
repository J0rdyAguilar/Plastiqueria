<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'message' => 'No autenticado'
            ], 401);
        }

        $rolUsuario = $this->normalizarRol($user->rol ?? $user->role ?? '');

        $rolesPermitidos = array_map(function ($r) {
            return $this->normalizarRol($r);
        }, $roles);

        if (!in_array($rolUsuario, $rolesPermitidos, true)) {
            return response()->json([
                'message' => 'No autorizado',
                'debug' => [
                    'usuario_id' => $user->id ?? null,
                    'usuario' => $user->usuario ?? null,
                    'nombre' => $user->nombre ?? null,
                    'rol_original' => $user->rol ?? $user->role ?? null,
                    'rol_normalizado' => $rolUsuario,
                    'roles_recibidos' => $roles,
                    'roles_normalizados' => $rolesPermitidos,
                    'path' => $request->path(),
                ],
            ], 403);
        }

        return $next($request);
    }

    private function normalizarRol($rol): string
    {
        $rol = strtolower(trim((string) $rol));
        $rol = str_replace([' ', '-'], '_', $rol);

        if ($rol === 'superadmin') {
            return 'super_admin';
        }

        return $rol;
    }
}