<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Caja;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CajaController extends Controller
{
    // GET /api/v1/caja/actual?ubicacion_id=1
    public function actual(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        $ubicacionId = $request->query('ubicacion_id');

        if (($ubicacionId === null || $ubicacionId === '') && !empty($user->ubicacion_id)) {
            $ubicacionId = (int) $user->ubicacion_id;
        }

        $q = Caja::query()
            ->with(['ubicacion'])
            ->whereNull('cerrado_en');

        if ($ubicacionId !== null && $ubicacionId !== '') {
            $q->where('ubicacion_id', (int) $ubicacionId);
        }

        $caja = $q->orderByDesc('id')->first();

        return response()->json([
            'data' => $caja,
        ]);
    }

    // GET /api/v1/caja/historial?ubicacion_id=1&per_page=15
    public function historial(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        $ubicacionId = $request->query('ubicacion_id');

        if (($ubicacionId === null || $ubicacionId === '') && !empty($user->ubicacion_id)) {
            $ubicacionId = (int) $user->ubicacion_id;
        }

        $perPage = max(1, min((int) $request->query('per_page', 15), 100));

        $q = Caja::query()
            ->with(['ubicacion', 'usuarioApertura'])
            ->orderByDesc('id');

        if ($ubicacionId !== null && $ubicacionId !== '') {
            $q->where('ubicacion_id', (int) $ubicacionId);
        }

        return response()->json($q->paginate($perPage));
    }

    // POST /api/v1/caja/abrir
    public function abrir(Request $request)
    {
        $data = $request->validate([
            'ubicacion_id' => ['nullable', 'integer'],
            'efectivo_inicial' => ['required', 'numeric', 'min:0'],
            'notas' => ['nullable', 'string', 'max:1000'],
        ]);

        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        $ubicacionId = (int) ($data['ubicacion_id'] ?? $user->ubicacion_id ?? 0);

        if (!$ubicacionId) {
            throw ValidationException::withMessages([
                'ubicacion_id' => ['El usuario no tiene una sucursal asignada.'],
            ]);
        }

        return DB::transaction(function () use ($data, $user, $ubicacionId) {
            $abierta = Caja::query()
                ->where('ubicacion_id', $ubicacionId)
                ->whereNull('cerrado_en')
                ->lockForUpdate()
                ->first();

            if ($abierta) {
                return response()->json([
                    'message' => 'Ya existe una caja abierta para esta sucursal.',
                    'data' => $abierta->load('ubicacion'),
                ], 409);
            }

            $caja = Caja::create([
                'abierto_por' => $user->id,
                'ubicacion_id' => $ubicacionId,
                'abierto_en' => Carbon::now(),
                'cerrado_en' => null,
                'efectivo_inicial' => $data['efectivo_inicial'],
                'efectivo_final' => null,
                'notas' => $data['notas'] ?? null,
            ]);

            return response()->json([
                'message' => 'Caja abierta correctamente',
                'data' => $caja->load('ubicacion'),
            ], 201);
        });
    }

    // POST /api/v1/caja/cerrar
    public function cerrar(Request $request)
    {
        $data = $request->validate([
            'ubicacion_id' => ['nullable', 'integer'],
            'efectivo_final' => ['required', 'numeric', 'min:0'],
            'notas' => ['nullable', 'string', 'max:1000'],
        ]);

        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'No autenticado'], 401);
        }

        $ubicacionId = (int) ($data['ubicacion_id'] ?? $user->ubicacion_id ?? 0);

        if (!$ubicacionId) {
            throw ValidationException::withMessages([
                'ubicacion_id' => ['El usuario no tiene una sucursal asignada.'],
            ]);
        }

        $caja = Caja::query()
            ->where('ubicacion_id', $ubicacionId)
            ->whereNull('cerrado_en')
            ->orderByDesc('id')
            ->first();

        if (!$caja) {
            return response()->json([
                'message' => 'No hay caja abierta para cerrar en esta sucursal.',
            ], 422);
        }

        $caja->efectivo_final = $data['efectivo_final'];
        $caja->cerrado_en = Carbon::now();

        if (!empty($data['notas'])) {
            $caja->notas = $data['notas'];
        }

        $caja->save();

        return response()->json([
            'message' => 'Caja cerrada correctamente',
            'data' => $caja->load('ubicacion'),
        ]);
    }
}