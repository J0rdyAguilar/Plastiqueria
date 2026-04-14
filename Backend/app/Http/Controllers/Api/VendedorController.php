<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Vendedor;
use Illuminate\Http\Request;

class VendedorController extends Controller
{
    public function index()
    {
        return response()->json(
            Vendedor::with('usuario')->get()
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'usuario_id' => 'required|exists:usuarios,id',
            'codigo' => 'required|string|max:50',
        ]);

        $vendedor = Vendedor::create($data);

        return response()->json($vendedor, 201);
    }

    public function show($id)
    {
        return response()->json(
            Vendedor::with('usuario')->findOrFail($id)
        );
    }

    public function update(Request $request, $id)
    {
        $vendedor = Vendedor::findOrFail($id);

        $data = $request->validate([
            'codigo' => 'sometimes|string|max:50',
        ]);

        $vendedor->update($data);

        return response()->json($vendedor);
    }

    public function destroy($id)
    {
        $vendedor = Vendedor::findOrFail($id);
        $vendedor->delete();

        return response()->json(['message' => 'Eliminado']);
    }

    public function asignarRutas(Request $request, $id)
    {
        $vendedor = Vendedor::findOrFail($id);

        $data = $request->validate([
            'ruta_ids' => 'array',
        ]);

        $vendedor->rutas()->sync($data['ruta_ids'] ?? []);

        return response()->json(['message' => 'Rutas asignadas']);
    }

    public function asignarClientes(Request $request, $id)
    {
        $vendedor = Vendedor::findOrFail($id);

        $data = $request->validate([
            'cliente_ids' => 'array',
        ]);

        $vendedor->clientes()->sync($data['cliente_ids'] ?? []);

        return response()->json(['message' => 'Clientes asignados']);
    }
}   