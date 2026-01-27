<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\CajaController;

Route::prefix('v1')
  ->middleware(['auth:sanctum', 'role:admin,super_admin,caja'])
  ->group(function () {
      Route::get('caja/actual', [CajaController::class, 'actual']);
      Route::get('caja/historial', [CajaController::class, 'historial']);
      Route::post('caja/abrir', [CajaController::class, 'abrir']);
      Route::post('caja/cerrar', [CajaController::class, 'cerrar']);
  });
// GET /api/v1/caja/actual?ubicacion_id=1