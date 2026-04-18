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
            |--------------------------------------------------------------------------
            | Quitar relaciones en tablas comunes
            |--------------------------------------------------------------------------
            */

            // CLIENTES
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
                if (Schema::hasColumn('clientes', 'creado_por')) {
                    DB::table('clientes')->where('creado_por', $userId)->update(['creado_por' => null]);
                }
                if (Schema::hasColumn('clientes', 'actualizado_por')) {
                    DB::table('clientes')->where('actualizado_por', $userId)->update(['actualizado_por' => null]);
                }
            }

            // RUTAS
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

            // ZONAS
            if (Schema::hasTable('zonas')) {
                if (Schema::hasColumn('zonas', 'usuario_id')) {
                    DB::table('zonas')->where('usuario_id', $userId)->update(['usuario_id' => null]);
                }
                if (Schema::hasColumn('zonas', 'vendedor_id')) {
                    DB::table('zonas')->where('vendedor_id', $userId)->update(['vendedor_id' => null]);
                }
                if (Schema::hasColumn('zonas', 'rutero_id')) {
                    DB::table('zonas')->where('rutero_id', $userId)->update(['rutero_id' => null]);
                }
            }

            // PEDIDOS
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
                if (Schema::hasColumn('pedidos', 'rechazado_por')) {
                    DB::table('pedidos')->where('rechazado_por', $userId)->update(['rechazado_por' => null]);
                }
                if (Schema::hasColumn('pedidos', 'entregado_por')) {
                    DB::table('pedidos')->where('entregado_por', $userId)->update(['entregado_por' => null]);
                }
            }

            // VENTAS
            if (Schema::hasTable('ventas')) {
                if (Schema::hasColumn('ventas', 'usuario_id')) {
                    DB::table('ventas')->where('usuario_id', $userId)->update(['usuario_id' => null]);
                }
                if (Schema::hasColumn('ventas', 'vendedor_id')) {
                    DB::table('ventas')->where('vendedor_id', $userId)->update(['vendedor_id' => null]);
                }
                if (Schema::hasColumn('ventas', 'rutero_id')) {
                    DB::table('ventas')->where('rutero_id', $userId)->update(['rutero_id' => null]);
                }
                if (Schema::hasColumn('ventas', 'cajero_id')) {
                    DB::table('ventas')->where('cajero_id', $userId)->update(['cajero_id' => null]);
                }
                if (Schema::hasColumn('ventas', 'creado_por')) {
                    DB::table('ventas')->where('creado_por', $userId)->update(['creado_por' => null]);
                }
            }

            // CREDITOS
            if (Schema::hasTable('creditos')) {
                if (Schema::hasColumn('creditos', 'usuario_id')) {
                    DB::table('creditos')->where('usuario_id', $userId)->update(['usuario_id' => null]);
                }
                if (Schema::hasColumn('creditos', 'vendedor_id')) {
                    DB::table('creditos')->where('vendedor_id', $userId)->update(['vendedor_id' => null]);
                }
                if (Schema::hasColumn('creditos', 'rutero_id')) {
                    DB::table('creditos')->where('rutero_id', $userId)->update(['rutero_id' => null]);
                }
            }

            // ABONOS
            if (Schema::hasTable('abonos')) {
                if (Schema::hasColumn('abonos', 'usuario_id')) {
                    DB::table('abonos')->where('usuario_id', $userId)->update(['usuario_id' => null]);
                }
                if (Schema::hasColumn('abonos', 'cajero_id')) {
                    DB::table('abonos')->where('cajero_id', $userId)->update(['cajero_id' => null]);
                }
                if (Schema::hasColumn('abonos', 'vendedor_id')) {
                    DB::table('abonos')->where('vendedor_id', $userId)->update(['vendedor_id' => null]);
                }
            }

            // CAJAS
            if (Schema::hasTable('cajas')) {
                if (Schema::hasColumn('cajas', 'usuario_id')) {
                    DB::table('cajas')->where('usuario_id', $userId)->update(['usuario_id' => null]);
                }
                if (Schema::hasColumn('cajas', 'cajero_id')) {
                    DB::table('cajas')->where('cajero_id', $userId)->update(['cajero_id' => null]);
                }
                if (Schema::hasColumn('cajas', 'abierta_por')) {
                    DB::table('cajas')->where('abierta_por', $userId)->update(['abierta_por' => null]);
                }
                if (Schema::hasColumn('cajas', 'cerrada_por')) {
                    DB::table('cajas')->where('cerrada_por', $userId)->update(['cerrada_por' => null]);
                }
            }

            // CAJA_MOVIMIENTOS
            if (Schema::hasTable('caja_movimientos')) {
                if (Schema::hasColumn('caja_movimientos', 'usuario_id')) {
                    DB::table('caja_movimientos')->where('usuario_id', $userId)->update(['usuario_id' => null]);
                }
                if (Schema::hasColumn('caja_movimientos', 'cajero_id')) {
                    DB::table('caja_movimientos')->where('cajero_id', $userId)->update(['cajero_id' => null]);
                }
                if (Schema::hasColumn('caja_movimientos', 'creado_por')) {
                    DB::table('caja_movimientos')->where('creado_por', $userId)->update(['creado_por' => null]);
                }
            }

            // USUARIOS <-> RUTAS pivote
            if (Schema::hasTable('ruta_usuario')) {
                if (Schema::hasColumn('ruta_usuario', 'usuario_id')) {
                    DB::table('ruta_usuario')->where('usuario_id', $userId)->delete();
                }
            }

            // USUARIOS <-> ZONAS pivote
            if (Schema::hasTable('usuario_zona')) {
                if (Schema::hasColumn('usuario_zona', 'usuario_id')) {
                    DB::table('usuario_zona')->where('usuario_id', $userId)->delete();
                }
            }

            // USUARIOS <-> CLIENTES pivote
            if (Schema::hasTable('cliente_usuario')) {
                if (Schema::hasColumn('cliente_usuario', 'usuario_id')) {
                    DB::table('cliente_usuario')->where('usuario_id', $userId)->delete();
                }
            }

            // AUDIT / LOGS si existen
            if (Schema::hasTable('activity_log')) {
                if (Schema::hasColumn('activity_log', 'causer_id')) {
                    DB::table('activity_log')
                        ->where('causer_id', $userId)
                        ->where('causer_type', Usuario::class)
                        ->update([
                            'causer_id' => null,
                            'causer_type' => null,
                        ]);
                }
            }

            if (Schema::hasTable('audits')) {
                if (Schema::hasColumn('audits', 'user_id')) {
                    DB::table('audits')->where('user_id', $userId)->update(['user_id' => null]);
                }
            }

            /*
            |--------------------------------------------------------------------------
            | Intento final de borrado
            |--------------------------------------------------------------------------
            */
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
                'usuario_id' => $usuario->id,
            ], 500);
        }
    }
}