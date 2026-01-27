<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ZonaController;

Route::prefix('v1')
    ->middleware('auth:sanctum')
    ->group(function () {
        Route::apiResource('zonas', ZonaController::class);
    });
