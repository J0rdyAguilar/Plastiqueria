<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Zona;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ZonaController extends Controller
{
    // GET /api/v1/zonas?q=&per_page=10
    public function index(Request $request)
    {
        $q = $request->query('q');
        $perPage = (int) $request->query('per_page', 50);
        $perPage = max(1, min($perPage, 200));

        $zonas = Zona::query()
            ->when($q, fn($qq) => $qq->where('nombre', 'like', "%$q%"))
            ->orderBy('nombre')
            ->paginate($perPage);

        return response()->json($zonas);
    }

    // POST /api/v1/zonas
    public function store(Request $request)
    {
        $data = $request->validate([
            'nombre' => ['required','string','max:120', Rule::unique('zonas','nombre')],
        ]);

        $zona = Zona::create([
            'nombre' => trim($data['nombre']),
        ]);

        return response()->json($zona, 201);
    }

    // GET /api/v1/zonas/{zona}
    public function show(Zona $zona)
    {
        return response()->json($zona);
    }

    // PUT /api/v1/zonas/{zona}
    public function update(Request $request, Zona $zona)
    {
        $data = $request->validate([
            'nombre' => ['required','string','max:120', Rule::unique('zonas','nombre')->ignore($zona->id)],
        ]);

        $zona->update([
            'nombre' => trim($data['nombre']),
        ]);

        return response()->json($zona);
    }

    // DELETE /api/v1/zonas/{zona}
    public function destroy(Zona $zona)
    {
        // opcional: impedir borrar si tiene rutas
        // if ($zona->rutas()->exists()) return response()->json(['message'=>'Zona tiene rutas'], 422);

        $zona->delete();
        return response()->json(['message' => 'Zona eliminada']);
    }
}
