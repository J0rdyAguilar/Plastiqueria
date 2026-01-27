<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Caja;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class CajaController extends Controller
{   // GET /api/v1/caja/actual?ubicacion_id=1
    // GET /api/v1/caja/actual?ubicacion_id=1
    public function actual(Request $request)
    {
        $ubicacionId = $request->query('ubicacion_id');

        $q = Caja::query()->whereNull('cerrado_en');

        if ($ubicacionId !== null && $ubicacionId !== '') {
            $q->where('ubicacion_id', (int)$ubicacionId);
        }

        $caja = $q->orderByDesc('id')->first();

        return response()->json(['data' => $caja]);
    }

    // GET /api/v1/caja/historial?ubicacion_id=1&per_page=15
    public function historial(Request $request)
    {
        $ubicacionId = $request->query('ubicacion_id');
        $perPage = max(1, min((int)$request->query('per_page', 15), 100));

        $q = Caja::query()->orderByDesc('id');

        if ($ubicacionId !== null && $ubicacionId !== '') {
            $q->where('ubicacion_id', (int)$ubicacionId);
        }

        return response()->json($q->paginate($perPage));
    }

    // POST /api/v1/caja/abrir
    public function abrir(Request $request)
    {
        $data = $request->validate([
            'ubicacion_id' => ['required', 'integer'], // ✅ OJO: required (tu BD no permite null)
            'efectivo_inicial' => ['required', 'numeric', 'min:0'],
            'notas' => ['nullable', 'string', 'max:1000'],
        ]);

        $user = $request->user();
        if (!$user) return response()->json(['message' => 'No autenticado'], 401);

        $ubicacionId = (int)$data['ubicacion_id'];

        // 🔒 Transacción para evitar que 2 personas abran al mismo tiempo
        return DB::transaction(function () use ($data, $user, $ubicacionId) {

            $abierta = Caja::query()
                ->where('ubicacion_id', $ubicacionId)
                ->whereNull('cerrado_en')
                ->lockForUpdate()
                ->first();

            if ($abierta) {
                return response()->json([
                    'message' => 'Ya existe una caja abierta para esta ubicación.',
                    'data' => $abierta,
                ], 409); // ✅ Conflict
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
                'data' => $caja,
            ], 201);
        });
    }

    // POST /api/v1/caja/cerrar
    public function cerrar(Request $request)
    {
        $data = $request->validate([
            'ubicacion_id' => ['required', 'integer'], // ✅ required
            'efectivo_final' => ['required', 'numeric', 'min:0'],
            'notas' => ['nullable', 'string', 'max:1000'],
        ]);

        $ubicacionId = (int)$data['ubicacion_id'];

        $q = Caja::query()
            ->where('ubicacion_id', $ubicacionId)
            ->whereNull('cerrado_en')
            ->orderByDesc('id');

        $caja = $q->first();

        if (!$caja) {
            return response()->json([
                'message' => 'No hay caja abierta para cerrar.',
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
            'data' => $caja,
        ]);
    }
}
