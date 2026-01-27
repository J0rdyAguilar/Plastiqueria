<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\VendedorController;

Route::prefix('v1')
    ->middleware('auth:sanctum')
    ->group(function () {
        Route::apiResource('vendedores', VendedorController::class);
    });
