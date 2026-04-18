<?php

namespace App\Http\Controllers\Api;

use App\Models\Usuario;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUsuarioRequest;
use App\Http\Requests\UpdateUsuarioRequest;
use App\Http\Resources\UsuarioResource;

class UsuarioController extends Controller
{
    public function index(Request $request)
    {
        $q = $request->query('q');
        $rol = $request->query('rol');
        $activo = $request->query('activo');
        $ubicacionId = $request->query('ubicacion_id');
        $perPage = (int) $request->query('per_page', 10);
        $perPage = max(1, min($perPage, 100));

        $usuarios = Usuario::with('ubicacion')
            ->when($q, function ($query) use ($q) {
                $query->where(function ($qq) use ($q) {
                    $qq->where('nombre', 'like', "%{$q}%")
                        ->orWhere('usuario', 'like', "%{$q}%")
                        ->orWhere('telefono', 'like', "%{$q}%");
                });
            })
            ->when($rol, fn ($query) => $query->where('rol', $rol))
            ->when($activo !== null && $activo !== '', fn ($query) => $query->where('activo', (int) $activo))
            ->when($ubicacionId, fn ($query) => $query->where('ubicacion_id', $ubicacionId))
            ->orderByDesc('id')
            ->paginate($perPage);

        return UsuarioResource::collection($usuarios);
    }

    public function store(StoreUsuarioRequest $request)
    {
        $data = $request->validated();

        if (!array_key_exists('activo', $data) || $data['activo'] === null) {
            $data['activo'] = 1;
        } else {
            $data['activo'] = $data['activo'] ? 1 : 0;
        }

        $usuario = Usuario::create($data);
        $usuario->load('ubicacion');

        return (new UsuarioResource($usuario))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Usuario $usuario)
    {
        $usuario->load('ubicacion');

        return new UsuarioResource($usuario);
    }

    public function update(UpdateUsuarioRequest $request, Usuario $usuario)
    {
        $data = $request->validated();

        if (array_key_exists('activo', $data) && $data['activo'] !== null) {
            $data['activo'] = $data['activo'] ? 1 : 0;
        }

        if (array_key_exists('password', $data) && empty($data['password'])) {
            unset($data['password']);
        }

        $usuario->update($data);
        $usuario->load('ubicacion');

        return new UsuarioResource($usuario);
    }

    public function destroy(Usuario $usuario)
    {
        DB::beginTransaction();

        try {
            $userId = $usuario->id;

            $tablasColumnas = [
                'clientes' => ['usuario_id', 'vendedor_id', 'rutero_id', 'creado_por', 'actualizado_por'],
                'rutas' => ['usuario_id', 'vendedor_id', 'rutero_id'],
                'zonas' => ['usuario_id', 'vendedor_id', 'rutero_id'],

                'pedidos' => ['vendedor_id', 'rutero_id'],
                'ventas' => ['usuario_id', 'vendedor_id', 'rutero_id', 'cajero_id', 'creado_por'],
                'creditos' => ['usuario_id', 'vendedor_id', 'rutero_id'],
                'abonos' => ['usuario_id', 'cajero_id', 'vendedor_id'],

                'cajas' => ['usuario_id', 'cajero_id', 'abierto_por', 'cerrado_por', 'cerrada_por'],
                'movimientos_caja' => ['usuario_id', 'cajero_id', 'vendedor_id', 'rutero_id'],
                'movimientos_stock' => ['creado_por'],

                'pagos' => ['recibido_por'],
                'entregas' => ['entregado_por'],
                'ventas_tienda' => ['usuario_id'],
                'revision_pedidos' => ['revisado_por'],
                'impresiones' => ['impreso_por'],
                'vendedores' => ['usuario_id'],

                'cuotas' => ['usuario_id', 'creado_por', 'actualizado_por', 'rutero_id'],
                'abonos_cuotas' => ['usuario_id'],
            ];

            foreach ($tablasColumnas as $tabla => $columnas) {
                if (!Schema::hasTable($tabla)) {
                    continue;
                }

                foreach ($columnas as $columna) {
                    if (!Schema::hasColumn($tabla, $columna)) {
                        continue;
                    }

                    DB::table($tabla)
                        ->where($columna, $userId)
                        ->update([$columna => null]);
                }
            }

            $tablasPivote = [
                'ruta_usuario',
                'usuario_zona',
                'cliente_usuario',
            ];

            foreach ($tablasPivote as $tabla) {
                if (Schema::hasTable($tabla) && Schema::hasColumn($tabla, 'usuario_id')) {
                    DB::table($tabla)->where('usuario_id', $userId)->delete();
                }
            }

            $usuario->delete();

            DB::commit();

            return response()->json([
                'message' => 'Usuario eliminado correctamente',
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'No se pudo eliminar el usuario',
                'error' => $e->getMessage(),
                'line' => $e->getLine(),
                'file' => $e->getFile(),
            ], 500);
        }
    }
}