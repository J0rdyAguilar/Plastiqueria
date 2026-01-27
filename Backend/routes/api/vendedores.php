<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\VendedorController;

Route::prefix('v1')
    ->middleware('auth:sanctum')
    ->group(function () {
        Route::apiResource('vendedores', VendedorController::class);
        Route::post('vendedores/{vendedor}/rutas', [VendedorController::class, 'asignarRutas']);
        Route::post('vendedores/{vendedor}/clientes', [VendedorController::class, 'asignarClientes']);
    });
