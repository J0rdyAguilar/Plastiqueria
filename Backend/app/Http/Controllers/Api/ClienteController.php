<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\Vendedor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ClienteController extends Controller
{
    // GET /api/clientes?q=&ruta_id=&zona_id=&activo=1&vendedor_id=&per_page=10
    public function index(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $rutaId = $request->query('ruta_id');
        $zonaId = $request->query('zona_id');
        $activo = $request->query('activo');
        $vendedorId = $request->query('vendedor_id');
        $perPage = (int) $request->query('per_page', 10);
        $perPage = max(1, min($perPage, 200));

        $query = Cliente::query()
            ->with([
                'ruta:id,nombre,zona_id',
                'zona:id,nombre',
            ]);

        if ($q !== '') {
            $query->where(function ($w) use ($q) {
                $w->where('nombre', 'like', "%{$q}%")
                  ->orWhere('propietario', 'like', "%{$q}%")
                  ->orWhere('telefono', 'like', "%{$q}%")
                  ->orWhere('direccion', 'like', "%{$q}%");
            });
        }

        if ($rutaId) {
            $query->where('ruta_id', $rutaId);
        }

        if ($zonaId) {
            $query->where('zona_id', $zonaId);
        }

        if ($activo !== null && $activo !== '') {
            $query->where('activo', (int) $activo);
        }

        if ($vendedorId) {
            $query->whereHas('vendedores', function ($q) use ($vendedorId) {
                $q->where('vendedores.id', $vendedorId)
                  ->where('vendedor_clientes.activo', 1);
            });
        }

        $items = $query
            ->orderBy('nombre')
            ->paginate($perPage)
            ->through(function ($c) {
                return [
                    'id' => $c->id,
                    'nombre' => $c->nombre,
                    'propietario' => $c->propietario,
                    'telefono' => $c->telefono,
                    'direccion' => $c->direccion,
                    'referencia' => $c->referencia,
                    'lat' => $c->lat,
                    'lng' => $c->lng,
                    'activo' => $c->activo,
                    'ruta_id' => $c->ruta_id,
                    'ruta_nombre' => $c->ruta?->nombre,
                    'zona_id' => $c->zona_id,
                    'zona_nombre' => $c->zona?->nombre,
                    'creado_en' => optional($c->creado_en)?->format('Y-m-d H:i:s'),
                ];
            });

        return response()->json($items);
    }

    // POST /api/clientes
    public function store(Request $request)
    {
        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:160'],
            'propietario' => ['nullable', 'string', 'max:160'],
            'telefono' => ['nullable', 'string', 'max:50'],
            'zona_id' => ['required', 'integer', Rule::exists('zonas', 'id')],
            'ruta_id' => ['required', 'integer', Rule::exists('rutas', 'id')],
            'direccion' => ['nullable', 'string'],
            'referencia' => ['nullable', 'string'],
            'lat' => ['nullable', 'numeric'],
            'lng' => ['nullable', 'numeric'],
            'activo' => ['nullable', 'boolean'],
            'vendedor_id' => ['nullable', 'integer', Rule::exists('vendedores', 'id')],
        ]);

        return DB::transaction(function () use ($data) {
            $cliente = Cliente::create([
                'nombre' => trim($data['nombre']),
                'propietario' => $data['propietario'] ?? null,
                'telefono' => $data['telefono'] ?? null,
                'zona_id' => $data['zona_id'],
                'ruta_id' => $data['ruta_id'],
                'direccion' => $data['direccion'] ?? null,
                'referencia' => $data['referencia'] ?? null,
                'lat' => $data['lat'] ?? null,
                'lng' => $data['lng'] ?? null,
                'activo' => array_key_exists('activo', $data) ? (int) $data['activo'] : 1,
            ]);

            if (!empty($data['vendedor_id'])) {
                $vendedor = Vendedor::findOrFail($data['vendedor_id']);

                $vendedor->clientes()->syncWithoutDetaching([
                    $cliente->id => [
                        'asignado_en' => now(),
                        'activo' => 1,
                    ]
                ]);
            }

            return response()->json([
                'message' => 'Cliente creado correctamente.',
                'data' => $cliente->load([
                    'ruta:id,nombre,zona_id',
                    'zona:id,nombre',
                ]),
            ], 201);
        });
    }

    // GET /api/clientes/{cliente}
    public function show(Cliente $cliente)
    {
        return response()->json(
            $cliente->load([
                'ruta:id,nombre,zona_id',
                'zona:id,nombre',
            ])
        );
    }

    // PUT /api/clientes/{cliente}
    public function update(Request $request, Cliente $cliente)
    {
        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:160'],
            'propietario' => ['nullable', 'string', 'max:160'],
            'telefono' => ['nullable', 'string', 'max:50'],
            'zona_id' => ['required', 'integer', Rule::exists('zonas', 'id')],
            'ruta_id' => ['required', 'integer', Rule::exists('rutas', 'id')],
            'direccion' => ['nullable', 'string'],
            'referencia' => ['nullable', 'string'],
            'lat' => ['nullable', 'numeric'],
            'lng' => ['nullable', 'numeric'],
            'activo' => ['nullable', 'boolean'],
        ]);

        $cliente->update([
            'nombre' => trim($data['nombre']),
            'propietario' => $data['propietario'] ?? null,
            'telefono' => $data['telefono'] ?? null,
            'zona_id' => $data['zona_id'],
            'ruta_id' => $data['ruta_id'],
            'direccion' => $data['direccion'] ?? null,
            'referencia' => $data['referencia'] ?? null,
            'lat' => $data['lat'] ?? null,
            'lng' => $data['lng'] ?? null,
            'activo' => array_key_exists('activo', $data) ? (int) $data['activo'] : $cliente->activo,
        ]);

        return response()->json([
            'message' => 'Cliente actualizado correctamente.',
            'data' => $cliente->fresh()->load([
                'ruta:id,nombre,zona_id',
                'zona:id,nombre',
            ]),
        ]);
    }

    // DELETE /api/clientes/{cliente}
    public function destroy(Cliente $cliente)
    {
        $cliente->vendedores()->detach();
        $cliente->delete();

        return response()->json([
            'message' => 'Cliente eliminado correctamente.'
        ]);
    }
}