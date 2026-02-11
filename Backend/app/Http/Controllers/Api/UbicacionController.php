<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UbicacionStoreRequest;
use App\Http\Requests\UbicacionUpdateRequest;
use App\Models\Ubicacion;
use Illuminate\Http\Request;

class UbicacionController extends Controller
{
    // GET /api/ubicaciones?q=&tipo=&activa=&page=
    public function index(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $tipo = $request->query('tipo');     // bodega|tienda
        $activa = $request->query('activa'); // 1|0

        $query = Ubicacion::query();

        if ($q !== '') {
            $query->where(function ($w) use ($q) {
                $w->where('nombre', 'like', "%{$q}%")
                  ->orWhere('direccion', 'like', "%{$q}%");
            });
        }

        if ($tipo !== null && $tipo !== '') {
            $query->where('tipo', $tipo);
        }

        if ($activa !== null && $activa !== '') {
            $query->where('activa', (int) $activa);
        }

        $items = $query
            ->orderBy('nombre')
            ->paginate((int) $request->query('per_page', 10));

        return response()->json($items);
    }

    // POST /api/ubicaciones
    public function store(UbicacionStoreRequest $request)
    {
        $data = $request->validated();

        // default activa = 1 si no viene
        if (!array_key_exists('activa', $data)) {
            $data['activa'] = 1;
        }

        $u = Ubicacion::create($data);

        return response()->json([
            'message' => 'Ubicación creada.',
            'data' => $u,
        ], 201);
    }

    // GET /api/ubicaciones/{id}
    public function show(Ubicacion $ubicacion)
    {
        return response()->json($ubicacion);
    }

    // PUT/PATCH /api/ubicaciones/{id}
    public function update(UbicacionUpdateRequest $request, Ubicacion $ubicacion)
    {
        $ubicacion->update($request->validated());

        return response()->json([
            'message' => 'Ubicación actualizada.',
            'data' => $ubicacion->fresh(),
        ]);
    }

    // PATCH /api/ubicaciones/{id}/toggle
    public function toggle(Ubicacion $ubicacion)
    {
        $ubicacion->activa = !$ubicacion->activa;
        $ubicacion->save();

        return response()->json([
            'message' => $ubicacion->activa ? 'Ubicación activada.' : 'Ubicación desactivada.',
            'data' => $ubicacion->fresh(),
        ]);
    }
}
