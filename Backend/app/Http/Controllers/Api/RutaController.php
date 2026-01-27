<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ruta;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RutaController extends Controller
{
    // GET /api/v1/rutas?q=&activo=1&per_page=10
    public function index(Request $request)
    {
        $q = $request->query('q');
        $activo = $request->query('activo'); // 0/1
        $perPage = (int) $request->query('per_page', 10);
        $perPage = max(1, min($perPage, 100));

        $rutas = Ruta::query()
            ->when($q, fn($qq) => $qq->where('nombre', 'like', "%$q%"))
            ->when($activo !== null && $activo !== '', fn($qq) => $qq->where('activo', (int)$activo))
            ->orderBy('nombre')
            ->paginate($perPage);

        return response()->json($rutas);
    }

            // POST /api/v1/rutas
            public function store(Request $request)
            {
                $data = $request->validate([
                    'zona_id' => ['required','integer', Rule::exists('zonas','id')],
                    'nombre'  => ['required','string','max:120'],
                ]);

                // Si querés único por zona:
                // 'nombre' => ['required','string','max:120', Rule::unique('rutas','nombre')->where('zona_id', $data['zona_id'])],

                $ruta = Ruta::create([
                    'zona_id' => $data['zona_id'],
                    'nombre'  => trim($data['nombre']),
                ]);

                return response()->json($ruta, 201);
            }

            public function update(Request $request, Ruta $ruta)
            {
                $data = $request->validate([
                    'zona_id' => ['required','integer', Rule::exists('zonas','id')],
                    'nombre'  => ['required','string','max:120'],
                ]);

                $ruta->update([
                    'zona_id' => $data['zona_id'],
                    'nombre'  => trim($data['nombre']),
                ]);

                return response()->json($ruta);
            }


    // DELETE /api/v1/rutas/{ruta}
    public function destroy(Ruta $ruta)
    {
        // opcional: impedir borrar si tiene vendedores asignados
        // if ($ruta->vendedores()->exists()) return response()->json(['message'=>'Ruta en uso'], 422);

        $ruta->delete();
        return response()->json(['message' => 'Ruta eliminada']);
    }
}
