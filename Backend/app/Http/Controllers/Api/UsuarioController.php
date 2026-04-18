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

            /*
             |--------------------------------------------------------------
             | Quitar referencias en tablas comunes
             |--------------------------------------------------------------
             | Esto evita errores por foreign keys al eliminar el usuario.
             | Ajusta o agrega más tablas si en tu sistema existen otras.
             */

            // clientes
            if (Schema::hasTable('clientes')) {
                if (Schema::hasColumn('clientes', 'usuario_id')) {
                    DB::table('clientes')->where('usuario_id', $userId)->update(['usuario_id' => null]);
                }
                if (Schema::hasColumn('clientes', 'vendedor_id')) {
                    DB::table('clientes')->where('vendedor_id', $userId)->update(['vendedor_id' => null]);
                }
                if (Schema::hasColumn('clientes', 'rutero_id')) {
                    DB::table('clientes')->where('rutero_id', $userId)->update(['rutero_id' => null]);
                }
            }

            // rutas
            if (Schema::hasTable('rutas')) {
                if (Schema::hasColumn('rutas', 'usuario_id')) {
                    DB::table('rutas')->where('usuario_id', $userId)->update(['usuario_id' => null]);
                }
                if (Schema::hasColumn('rutas', 'vendedor_id')) {
                    DB::table('rutas')->where('vendedor_id', $userId)->update(['vendedor_id' => null]);
                }
                if (Schema::hasColumn('rutas', 'rutero_id')) {
                    DB::table('rutas')->where('rutero_id', $userId)->update(['rutero_id' => null]);
                }
            }

            // zonas
            if (Schema::hasTable('zonas')) {
                if (Schema::hasColumn('zonas', 'usuario_id')) {
                    DB::table('zonas')->where('usuario_id', $userId)->update(['usuario_id' => null]);
                }
                if (Schema::hasColumn('zonas', 'vendedor_id')) {
                    DB::table('zonas')->where('vendedor_id', $userId)->update(['vendedor_id' => null]);
                }
            }

            // pedidos
            if (Schema::hasTable('pedidos')) {
                if (Schema::hasColumn('pedidos', 'usuario_id')) {
                    DB::table('pedidos')->where('usuario_id', $userId)->update(['usuario_id' => null]);
                }
                if (Schema::hasColumn('pedidos', 'vendedor_id')) {
                    DB::table('pedidos')->where('vendedor_id', $userId)->update(['vendedor_id' => null]);
                }
                if (Schema::hasColumn('pedidos', 'rutero_id')) {
                    DB::table('pedidos')->where('rutero_id', $userId)->update(['rutero_id' => null]);
                }
                if (Schema::hasColumn('pedidos', 'aprobado_por')) {
                    DB::table('pedidos')->where('aprobado_por', $userId)->update(['aprobado_por' => null]);
                }
            }

            // ventas
            if (Schema::hasTable('ventas')) {
                if (Schema::hasColumn('ventas', 'usuario_id')) {
                    DB::table('ventas')->where('usuario_id', $userId)->update(['usuario_id' => null]);
                }
                if (Schema::hasColumn('ventas', 'vendedor_id')) {
                    DB::table('ventas')->where('vendedor_id', $userId)->update(['vendedor_id' => null]);
                }
                if (Schema::hasColumn('ventas', 'cajero_id')) {
                    DB::table('ventas')->where('cajero_id', $userId)->update(['cajero_id' => null]);
                }
                if (Schema::hasColumn('ventas', 'rutero_id')) {
                    DB::table('ventas')->where('rutero_id', $userId)->update(['rutero_id' => null]);
                }
            }

            // caja_movimientos
            if (Schema::hasTable('caja_movimientos')) {
                if (Schema::hasColumn('caja_movimientos', 'usuario_id')) {
                    DB::table('caja_movimientos')->where('usuario_id', $userId)->update(['usuario_id' => null]);
                }
                if (Schema::hasColumn('caja_movimientos', 'cajero_id')) {
                    DB::table('caja_movimientos')->where('cajero_id', $userId)->update(['cajero_id' => null]);
                }
            }

            // cajas
            if (Schema::hasTable('cajas')) {
                if (Schema::hasColumn('cajas', 'usuario_id')) {
                    DB::table('cajas')->where('usuario_id', $userId)->update(['usuario_id' => null]);
                }
                if (Schema::hasColumn('cajas', 'cajero_id')) {
                    DB::table('cajas')->where('cajero_id', $userId)->update(['cajero_id' => null]);
                }
            }

            // creditos
            if (Schema::hasTable('creditos')) {
                if (Schema::hasColumn('creditos', 'usuario_id')) {
                    DB::table('creditos')->where('usuario_id', $userId)->update(['usuario_id' => null]);
                }
                if (Schema::hasColumn('creditos', 'vendedor_id')) {
                    DB::table('creditos')->where('vendedor_id', $userId)->update(['vendedor_id' => null]);
                }
            }

            // abonos
            if (Schema::hasTable('abonos')) {
                if (Schema::hasColumn('abonos', 'usuario_id')) {
                    DB::table('abonos')->where('usuario_id', $userId)->update(['usuario_id' => null]);
                }
                if (Schema::hasColumn('abonos', 'cajero_id')) {
                    DB::table('abonos')->where('cajero_id', $userId)->update(['cajero_id' => null]);
                }
            }

            // modelo usuario
            $usuario->delete();

            DB::commit();

            return response()->json([
                'message' => 'Usuario eliminado correctamente'
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'No se pudo eliminar el usuario',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
} 