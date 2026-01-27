<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class RoleMiddleware
{
    public function handle(Request $request, Closure $next, ...$roles)
    {
        $user = $request->user(); // Sanctum

        if (!$user) {
            return response()->json([
                'message' => 'No autenticado'
            ], 401);
        }

        $rolUsuario = strtolower((string) $user->rol);
        $rolesPermitidos = array_map(
            fn ($r) => strtolower(trim($r)),
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
// GET /api/v1/caja/actual?ubicacion_id=1