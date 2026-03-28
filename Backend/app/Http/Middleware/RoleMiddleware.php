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

        $rolUsuario = strtolower((string) $user->rol);

        $rolesPermitidos = array_map(
            fn ($r) => strtolower(trim((string) $r)),
            $roles
        );

        if (!in_array($rolUsuario, $rolesPermitidos, true)) {
            return response()->json([
                'message' => 'No autorizado'
            ], 403);
        }

        return $next($request);
    }
}