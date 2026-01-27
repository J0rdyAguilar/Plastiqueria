<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ubicacion;

class UbicacionController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => Ubicacion::orderBy('id')->get(),
        ]);
    }

    public function show(int $id)
    {
        $u = Ubicacion::find($id);

        if (!$u) {
            return response()->json(['message' => 'Ubicación no existe'], 404);
        }

        return response()->json(['data' => $u]);
    }
}
