<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\UbicacionController;

Route::prefix('v1')
    ->middleware(['auth:sanctum'])
    ->group(function () {
        Route::get('ubicaciones', [UbicacionController::class, 'index']);
        Route::get('ubicaciones/{id}', [UbicacionController::class, 'show']);
    });
// GET /api/v1/caja/actual?ubicacion_id=1