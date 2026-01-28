<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Vendedor;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class VendedorController extends Controller
{
    // GET /api/v1/vendedores?q=&activo=1&per_page=10
    // activo filtra por usuario.activo (no por vendedores.activo)
    public function index(Request $request)
    {
        $q = $request->query('q');
        $activo = $request->query('activo'); // 0/1 (usuario.activo)
        $perPage = (int) $request->query('per_page', 10);
        $perPage = max(1, min($perPage, 100));

        $vendedores = Vendedor::query()
            ->with([
                'usuario:id,nombre,usuario,telefono,rol,activo',
                // ✅ para que en el listado ya venga lo asignado
                'rutas' => function ($qq) {
                    $qq->select('rutas.id', 'rutas.nombre');
                },
            ])
            ->when($q, function ($query) use ($q) {
                $query->where('codigo', 'like', "%$q%")
                    ->orWhereHas('usuario', function ($u) use ($q) {
                        $u->where('nombre', 'like', "%$q%")
                          ->orWhere('usuario', 'like', "%$q%")
                          ->orWhere('telefono', 'like', "%$q%");
                    })
                    ->orWhereHas('rutas', function ($r) use ($q) {
                        // buscar también por nombre de ruta
                        $r->where('rutas.nombre', 'like', "%$q%");
                    });
            })
            ->when($activo !== null && $activo !== '', function ($query) use ($activo) {
                $query->whereHas('usuario', function ($u) use ($activo) {
                    $u->where('activo', (int) $activo);
                });
            })
            ->orderByDesc('id')
            ->paginate($perPage);

        return response()->json($vendedores);
    }

    // POST /api/v1/vendedores
    public function store(Request $request)
    {
        $data = $request->validate([
            'usuario_id' => ['required', 'integer', Rule::exists('usuarios', 'id')],
            'codigo'     => ['nullable', 'string', 'max:50', Rule::unique('vendedores', 'codigo')],
        ]);

        // Evitar que un usuario tenga 2 vendedores
        $exists = Vendedor::where('usuario_id', $data['usuario_id'])->exists();
        if ($exists) {
            return response()->json([
                'message' => 'Este usuario ya está vinculado a un vendedor.'
            ], 422);
        }

        $vendedor = Vendedor::create([
            'usuario_id' => $data['usuario_id'],
            'codigo'     => $data['codigo'] ?? null,
        ]);

        return response()->json(
            $vendedor->load(['usuario:id,nombre,usuario,telefono,rol,activo']),
            201
        );
    }

    // GET /api/v1/vendedores/{vendedor}
    public function show(Vendedor $vendedor)
    {
        $vendedor->load([
            'usuario:id,nombre,usuario,telefono,rol,activo',

            // ✅ IMPORTANTE: calificar columnas para evitar "id ambiguous"
            'rutas' => function ($q) {
                $q->select('rutas.id', 'rutas.nombre');
            },

            'clientes' => function ($q) {
                $q->select('clientes.id', 'clientes.nombre');
            },
        ]);

        return response()->json($vendedor);
    }

    // PUT/PATCH /api/v1/vendedores/{vendedor}
    public function update(Request $request, Vendedor $vendedor)
    {
        $data = $request->validate([
            'codigo' => [
                'nullable', 'string', 'max:50',
                Rule::unique('vendedores', 'codigo')->ignore($vendedor->id),
            ],
        ]);

        $vendedor->update($data);

        return response()->json(
            $vendedor->load(['usuario:id,nombre,usuario,telefono,rol,activo'])
        );
    }

    // DELETE /api/v1/vendedores/{vendedor}
    public function destroy(Vendedor $vendedor)
    {
        $vendedor->rutas()->detach();
        $vendedor->clientes()->detach();
        $vendedor->delete();

        return response()->json(['message' => 'Vendedor eliminado']);
    }

    // POST /api/v1/vendedores/{vendedor}/rutas
    // body: { "ruta_ids":[1,2,3], "modo":"sync|attach" }
    public function asignarRutas(Request $request, Vendedor $vendedor)
    {
        $data = $request->validate([
            'ruta_ids'   => ['required', 'array', 'min:1'],
            'ruta_ids.*' => ['integer', Rule::exists('rutas', 'id')],
            'modo'       => ['nullable', Rule::in(['sync', 'attach'])],
        ]);

        $modo = $data['modo'] ?? 'sync';

        if ($modo === 'attach') {
            $vendedor->rutas()->syncWithoutDetaching($data['ruta_ids']);
        } else {
            $vendedor->rutas()->sync($data['ruta_ids']);
        }

        return response()->json([
            'message' => 'Rutas asignadas',
            // ✅ calificado para evitar "id ambiguous" si el pivote tiene id
            'rutas' => $vendedor->rutas()
                ->select('rutas.id', 'rutas.nombre')
                ->get(),
        ]);
    }

    // POST /api/v1/vendedores/{vendedor}/clientes
    // body: { "cliente_ids":[1,2], "modo":"sync|attach" }
    public function asignarClientes(Request $request, Vendedor $vendedor)
    {
        $data = $request->validate([
            'cliente_ids'   => ['required', 'array', 'min:1'],
            'cliente_ids.*' => ['integer', Rule::exists('clientes', 'id')],
            'modo'          => ['nullable', Rule::in(['sync', 'attach'])],
        ]);

        $modo = $data['modo'] ?? 'sync';

        if ($modo === 'attach') {
            $vendedor->clientes()->syncWithoutDetaching($data['cliente_ids']);
        } else {
            $vendedor->clientes()->sync($data['cliente_ids']);
        }

        return response()->json([
            'message'  => 'Clientes asignados',
            // ✅ calificado para evitar "id ambiguous" si el pivote tiene id
            'clientes' => $vendedor->clientes()
                ->select('clientes.id', 'clientes.nombre')
                ->get(),
        ]);
    }
}
