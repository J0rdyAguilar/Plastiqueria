<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ClienteController;

Route::prefix('v1')
    ->middleware(['auth:sanctum'])
    ->group(function () {
        Route::middleware(['role:admin,super_admin,vendedor,vendedor-tienda'])->group(function () {
            Route::get('/clientes', [ClienteController::class, 'index']);
            Route::post('/clientes', [ClienteController::class, 'store']);
        });

        // El rutero solo obtiene lectura del perfil para consultar el crédito existente.
        Route::middleware(['role:admin,super_admin,vendedor,vendedor-tienda,rutero'])->group(function () {
            Route::get('/clientes/{cliente}', [ClienteController::class, 'show']);
        });

        Route::middleware(['role:admin,super_admin'])->group(function () {
            Route::put('/clientes/{cliente}', [ClienteController::class, 'update']);
            Route::delete('/clientes/{cliente}', [ClienteController::class, 'destroy']);
        });
    });
