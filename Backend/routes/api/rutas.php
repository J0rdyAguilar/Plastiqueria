<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\RutaController;

Route::prefix('v1')
    ->middleware('auth:sanctum')
    ->group(function () {
        Route::get('rutas', [RutaController::class, 'index']);
    });
