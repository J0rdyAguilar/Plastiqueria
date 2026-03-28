<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Zona;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ZonaController extends Controller
{
    public function index(Request $request)
    {
        $q = $request->query('q');
        $perPage = (int) $request->query('per_page', 50);
        $perPage = max(1, min($perPage, 200));

        $zonas = Zona::query()
            ->when($q, fn($qq) => $qq->where('nombre', 'like', "%{$q}%"))
            ->orderBy('nombre')
            ->paginate($perPage);

        return response()->json($zonas);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:120', Rule::unique('zonas', 'nombre')],
        ]);

        $zona = Zona::create([
            'nombre' => trim($data['nombre']),
        ]);

        return response()->json($zona, 201);
    }

    public function show(Zona $zona)
    {
        return response()->json($zona);
    }

    public function update(Request $request, Zona $zona)
    {
        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:120', Rule::unique('zonas', 'nombre')->ignore($zona->id)],
        ]);

        $zona->update([
            'nombre' => trim($data['nombre']),
        ]);

        return response()->json($zona);
    }

    public function destroy(Request $request, Zona $zona)
    {
        $user = $request->user();
        $isSuperAdmin = $user && ($user->rol === 'super_admin');

        if (!$isSuperAdmin) {
            if ($zona->rutas()->exists()) {
                return response()->json([
                    'message' => 'No se puede eliminar la zona porque tiene rutas asociadas.'
                ], 422);
            }
        }

        DB::transaction(function () use ($zona, $isSuperAdmin) {
            if ($isSuperAdmin) {
                $zona->load('rutas');

                foreach ($zona->rutas as $ruta) {
                    // Esto requiere que clientes.ruta_id acepte NULL
                    $ruta->clientes()->update([
                        'ruta_id' => null,
                    ]);

                    $ruta->vendedores()->detach();
                    $ruta->delete();
                }
            }

            $zona->delete();
        });

        return response()->json([
            'message' => 'Zona eliminada'
        ]);
    }
}