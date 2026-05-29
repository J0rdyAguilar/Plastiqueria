<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\VentaTiendaController;

Route::prefix('v1')
    ->middleware(['auth:sanctum', 'role:admin,super_admin,vendedor-tienda'])
    ->group(function () {
        Route::get('/ventas-tienda', [VentaTiendaController::class, 'index']);
        Route::get('/ventas-tienda/registro', [VentaTiendaController::class, 'registro']);
        Route::post('/ventas-tienda', [VentaTiendaController::class, 'store']);

        // Montos variables de ventas de tienda
        Route::get('/ventas-tienda/montos-variables/pendientes', [VentaTiendaController::class, 'montosVariablesPendientes']);
        Route::post('/ventas-tienda/{venta}/aprobar-monto-variable', [VentaTiendaController::class, 'aprobarMontoVariable']);
        Route::post('/ventas-tienda/{venta}/rechazar-monto-variable', [VentaTiendaController::class, 'rechazarMontoVariable']);

        Route::get('/ventas-tienda/{venta}', [VentaTiendaController::class, 'show']);
    });
