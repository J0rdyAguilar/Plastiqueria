<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\VentaTiendaController;

Route::prefix('v1')
    ->middleware(['auth:sanctum', 'role:admin,super_admin,vendedor-tienda'])
    ->group(function () {
        Route::get('ventas-tienda', [VentaTiendaController::class, 'index']);
        Route::post('ventas-tienda', [VentaTiendaController::class, 'store']);
    });