<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ruta;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RutaController extends Controller
{
    public function index(Request $request)
    {
        $q = $request->query('q');
        $activo = $request->query('activo');
        $perPage = (int) $request->query('per_page', 10);
        $perPage = max(1, min($perPage, 100));

        $rutas = Ruta::with('zona')
            ->when($q, fn($qq) => $qq->where('nombre', 'like', "%{$q}%"))
            ->when($activo !== null && $activo !== '', fn($qq) => $qq->where('activo', (int) $activo))
            ->orderBy('nombre')
            ->paginate($perPage);

        return response()->json($rutas);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'zona_id' => ['required', 'integer', Rule::exists('zonas', 'id')],
            'nombre'  => ['required', 'string', 'max:120'],
        ]);

        $ruta = Ruta::create([
            'zona_id' => $data['zona_id'],
            'nombre'  => trim($data['nombre']),
        ]);

        return response()->json($ruta->load('zona'), 201);
    }

    public function update(Request $request, Ruta $ruta)
    {
        $data = $request->validate([
            'zona_id' => ['required', 'integer', Rule::exists('zonas', 'id')],
            'nombre'  => ['required', 'string', 'max:120'],
        ]);

        $ruta->update([
            'zona_id' => $data['zona_id'],
            'nombre'  => trim($data['nombre']),
        ]);

        return response()->json($ruta->load('zona'));
    }

    public function destroy(Request $request, Ruta $ruta)
    {
        $user = $request->user();
        $isSuperAdmin = $user && ($user->rol === 'super_admin');

        if (!$isSuperAdmin) {
            if ($ruta->clientes()->exists()) {
                return response()->json([
                    'message' => 'No se puede eliminar la ruta porque tiene clientes asociados.'
                ], 422);
            }

            if ($ruta->vendedores()->exists()) {
                return response()->json([
                    'message' => 'No se puede eliminar la ruta porque tiene vendedores asociados.'
                ], 422);
            }
        }

        DB::transaction(function () use ($ruta, $isSuperAdmin) {
            if ($isSuperAdmin) {
                // Esto requiere que clientes.ruta_id acepte NULL
                $ruta->clientes()->update([
                    'ruta_id' => null,
                ]);

                $ruta->vendedores()->detach();
            }

            $ruta->delete();
        });

        return response()->json([
            'message' => 'Ruta eliminada'
        ]);
    }
}