<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ruta;
use Illuminate\Http\Request;

class RutaController extends Controller
{
    public function index(Request $request)
    {
        $q = $request->query('q');

        $rutas = Ruta::query()
            ->when($q, fn($qq) => $qq->where('nombre', 'like', "%$q%"))
            ->select('id','nombre')
            ->orderBy('nombre')
            ->get();

        return response()->json($rutas);
    }
}
