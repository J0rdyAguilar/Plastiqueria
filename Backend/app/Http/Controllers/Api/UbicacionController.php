<?php

namespace App\Http\Controllers\Api;

use App\Models\Ubicacion;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;

class UbicacionController extends Controller
{
    public function index(Request $request)
    {
        $q = $request->query('q');
        $activa = $request->query('activa');

        $ubicaciones = Ubicacion::query()
            ->when($q, function ($query) use ($q) {
                $query->where(function ($qq) use ($q) {
                    $qq->where('nombre', 'like', "%{$q}%")
                       ->orWhere('tipo', 'like', "%{$q}%")
                       ->orWhere('direccion', 'like', "%{$q}%");
                });
            })
            ->when($activa !== null && $activa !== '', function ($query) use ($activa) {
                $query->where('activa', (int) $activa);
            })
            ->orderBy('nombre')
            ->get();

        return response()->json([
            'data' => $ubicaciones
        ]);
    }

    public function show(Ubicacion $ubicacion)
    {
        return response()->json([
            'data' => $ubicacion
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'nombre'    => ['required', 'string', 'max:160'],
            'tipo'      => ['required', 'string', 'max:50'],
            'direccion' => ['nullable', 'string', 'max:255'],
            'activa'    => ['nullable', 'boolean'],
        ]);

        if (!array_key_exists('activa', $data)) {
            $data['activa'] = 1;
        }

        $ubicacion = Ubicacion::create($data);

        return response()->json([
            'message' => 'Ubicación creada correctamente.',
            'data' => $ubicacion
        ], 201);
    }

    public function update(Request $request, Ubicacion $ubicacion)
    {
        $data = $request->validate([
            'nombre'    => ['sometimes', 'required', 'string', 'max:160'],
            'tipo'      => ['sometimes', 'required', 'string', 'max:50'],
            'direccion' => ['nullable', 'string', 'max:255'],
            'activa'    => ['nullable', 'boolean'],
        ]);

        $ubicacion->update($data);

        return response()->json([
            'message' => 'Ubicación actualizada.',
            'data' => $ubicacion->fresh()
        ]);
    }

    public function toggle(Ubicacion $ubicacion)
    {
        $ubicacion->activa = !$ubicacion->activa;
        $ubicacion->save();

        return response()->json([
            'message' => $ubicacion->activa ? 'Ubicación activada.' : 'Ubicación desactivada.',
            'data' => $ubicacion->fresh()
        ]);
    }

    public function destroy(Ubicacion $ubicacion)
    {
        $ubicacion->delete();

        return response()->json([
            'message' => 'Ubicación eliminada.'
        ]);
    }
}