<?php

namespace App\Http\Controllers\Api;

use App\Models\Usuario;
use Illuminate\Http\Request;
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
        $usuario->delete();

        return response()->json([
            'message' => 'Usuario eliminado'
        ]);
    }
}