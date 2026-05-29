<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\Ruta;
use App\Models\Vendedor;
use App\Models\Zona;
use Illuminate\Http\Request;

class ClienteController extends Controller
{
    private function roleOf($user): string
    {
        $r = strtolower((string) ($user->rol ?? $user->role ?? ''));
        $r = str_replace([' ', '-'], '_', $r);

        if ($r === 'superadmin') return 'super_admin';
        if ($r === 'cajero') return 'caja';

        return $r;
    }

    private function resolveVendedorId($user): ?int
    {
        if (!empty($user->vendedor_id)) {
            return (int) $user->vendedor_id;
        }

        $userId = (int) ($user->id ?? 0);
        if ($userId <= 0) return null;

        $vend = Vendedor::query()
            ->where('usuario_id', $userId)
            ->first();

        return $vend ? (int) $vend->id : null;
    }

    private function resolveRutaPorDefecto(): ?int
    {
        $keywords = ['tienda', 'general', 'mostrador', 'sin ruta', 'default'];

        foreach ($keywords as $keyword) {
            $ruta = Ruta::query()
                ->whereRaw('LOWER(nombre) like ?', ['%' . strtolower($keyword) . '%'])
                ->first();

            if ($ruta) {
                return (int) $ruta->id;
            }
        }

        $primera = Ruta::query()->orderBy('id')->first();
        return $primera ? (int) $primera->id : null;
    }

    private function resolveZonaPorDefecto(): ?int
    {
        $keywords = ['tienda', 'general', 'mostrador', 'sin zona', 'default'];

        foreach ($keywords as $keyword) {
            $zona = Zona::query()
                ->whereRaw('LOWER(nombre) like ?', ['%' . strtolower($keyword) . '%'])
                ->first();

            if ($zona) {
                return (int) $zona->id;
            }
        }

        $primera = Zona::query()->orderBy('id')->first();
        return $primera ? (int) $primera->id : null;
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);

        $q = trim((string) $request->query('q', ''));
        $activo = $request->query('activo');
        $vendedorId = $request->query('vendedor_id');

        $query = Cliente::query()
            ->with([
                'ruta:id,nombre',
                'zona:id,nombre',
            ])
            ->orderBy('nombre');

        if ($role === 'super_admin' || $role === 'admin') {
            if ($vendedorId) {
                $query->whereHas('vendedores', function ($sub) use ($vendedorId) {
                    $sub->where('vendedores.id', (int) $vendedorId)
                        ->where('vendedor_clientes.activo', 1);
                });
            }
        } elseif (in_array($role, ['vendedor', 'vendedor_tienda'], true)) {
            /*
             * Antes aquí se filtraba por vendedor_clientes.
             * Eso hacía que el buscador de pedidos saliera vacío cuando los clientes
             * todavía no estaban asignados al vendedor.
             *
             * Ahora el vendedor puede consultar clientes activos para crear pedidos.
             * La seguridad sigue protegida por auth:sanctum + role en las rutas.
             */
        } else {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        if ($q !== '') {
            $query->where(function ($sub) use ($q) {
                $sub->where('nombre', 'like', "%{$q}%")
                    ->orWhere('propietario', 'like', "%{$q}%")
                    ->orWhere('telefono', 'like', "%{$q}%")
                    ->orWhere('direccion', 'like', "%{$q}%")
                    ->orWhere('referencia', 'like', "%{$q}%");
            });
        }

        if ($activo !== null && $activo !== '') {
            $query->where('activo', (int) $activo);
        }

        $page = $query->paginate((int) $request->query('per_page', 20));

        return response()->json($page);
    }

    public function show(Cliente $cliente, Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);

        if (!in_array($role, ['admin', 'super_admin', 'vendedor', 'vendedor_tienda'], true)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $cliente->load([
            'ruta:id,nombre',
            'zona:id,nombre',
        ]);

        return response()->json([
            'data' => $cliente,
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);
        $vendedorAuthId = $this->resolveVendedorId($user);

        if (!in_array($role, ['super_admin', 'admin', 'vendedor', 'vendedor_tienda'], true)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:150'],
            'propietario' => ['nullable', 'string', 'max:150'],
            'telefono' => ['nullable', 'string', 'max:50'],
            'ruta_id' => ['nullable', 'integer', 'exists:rutas,id'],
            'zona_id' => ['nullable', 'integer', 'exists:zonas,id'],
            'direccion' => ['nullable', 'string', 'max:255'],
            'referencia' => ['nullable', 'string', 'max:255'],
            'activo' => ['nullable', 'boolean'],
            'vendedor_id' => ['nullable', 'integer'],
        ]);

        if ($role === 'vendedor' && !$vendedorAuthId) {
            return response()->json([
                'message' => 'Este usuario aún no está vinculado correctamente como vendedor.'
            ], 422);
        }

        $rutaId = !empty($data['ruta_id']) ? (int) $data['ruta_id'] : null;
        $zonaId = !empty($data['zona_id']) ? (int) $data['zona_id'] : null;

        if (!$rutaId) {
            $rutaId = $this->resolveRutaPorDefecto();
        }

        if (!$zonaId) {
            $zonaId = $this->resolveZonaPorDefecto();
        }

        if (!$rutaId) {
            return response()->json([
                'message' => 'No existe ninguna ruta disponible para asignar al cliente.'
            ], 422);
        }

        if (!$zonaId) {
            return response()->json([
                'message' => 'No existe ninguna zona disponible para asignar al cliente.'
            ], 422);
        }

        $cliente = Cliente::create([
            'nombre' => trim((string) $data['nombre']),
            'propietario' => trim((string) ($data['propietario'] ?? '')),
            'telefono' => trim((string) ($data['telefono'] ?? '')),
            'ruta_id' => $rutaId,
            'zona_id' => $zonaId,
            'direccion' => trim((string) ($data['direccion'] ?? 'Sin dirección')),
            'referencia' => trim((string) ($data['referencia'] ?? '')),
            'activo' => array_key_exists('activo', $data) ? (bool) $data['activo'] : true,
            'creado_en' => now(),
            'actualizado_en' => now(),
        ]);

        $vendedorRelacionId = null;

        if ($role === 'vendedor') {
            $vendedorRelacionId = (int) $vendedorAuthId;
        } elseif (!empty($data['vendedor_id'])) {
            $vendedorRelacionId = (int) $data['vendedor_id'];
        } elseif ($vendedorAuthId) {
            $vendedorRelacionId = (int) $vendedorAuthId;
        }

        if ($vendedorRelacionId) {
            $yaExiste = $cliente->vendedores()
                ->where('vendedores.id', $vendedorRelacionId)
                ->exists();

            if (!$yaExiste) {
                $cliente->vendedores()->attach($vendedorRelacionId, [
                    'asignado_en' => now(),
                    'activo' => 1,
                ]);
            }
        }

        $cliente->load([
            'ruta:id,nombre',
            'zona:id,nombre',
        ]);

        return response()->json([
            'message' => 'Cliente creado correctamente.',
            'data' => $cliente,
        ], 201);
    }

    public function update(Request $request, Cliente $cliente)
    {
        $user = $request->user();
        $role = $this->roleOf($user);

        if (!in_array($role, ['super_admin', 'admin'], true)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:150'],
            'propietario' => ['nullable', 'string', 'max:150'],
            'telefono' => ['nullable', 'string', 'max:50'],
            'ruta_id' => ['nullable', 'integer', 'exists:rutas,id'],
            'zona_id' => ['nullable', 'integer', 'exists:zonas,id'],
            'direccion' => ['nullable', 'string', 'max:255'],
            'referencia' => ['nullable', 'string', 'max:255'],
            'activo' => ['nullable', 'boolean'],
        ]);

        $rutaId = !empty($data['ruta_id']) ? (int) $data['ruta_id'] : $cliente->ruta_id;
        $zonaId = !empty($data['zona_id']) ? (int) $data['zona_id'] : $cliente->zona_id;

        if (!$rutaId) {
            $rutaId = $this->resolveRutaPorDefecto();
        }

        if (!$zonaId) {
            $zonaId = $this->resolveZonaPorDefecto();
        }

        $cliente->update([
            'nombre' => trim((string) $data['nombre']),
            'propietario' => trim((string) ($data['propietario'] ?? '')),
            'telefono' => trim((string) ($data['telefono'] ?? '')),
            'ruta_id' => $rutaId,
            'zona_id' => $zonaId,
            'direccion' => trim((string) ($data['direccion'] ?? 'Sin dirección')),
            'referencia' => trim((string) ($data['referencia'] ?? '')),
            'activo' => array_key_exists('activo', $data) ? (bool) $data['activo'] : $cliente->activo,
            'actualizado_en' => now(),
        ]);

        $cliente->load([
            'ruta:id,nombre',
            'zona:id,nombre',
        ]);

        return response()->json([
            'message' => 'Cliente actualizado correctamente.',
            'data' => $cliente,
        ]);
    }

    public function destroy(Cliente $cliente, Request $request)
    {
        $user = $request->user();
        $role = $this->roleOf($user);

        if (!in_array($role, ['super_admin', 'admin'], true)) {
            return response()->json(['message' => 'No autorizado.'], 403);
        }

        $cliente->delete();

        return response()->json([
            'message' => 'Cliente eliminado.',
        ]);
    }
}
