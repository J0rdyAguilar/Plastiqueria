<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ClienteController;

Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/clientes', [ClienteController::class, 'index']);
    Route::get('/clientes/{cliente}', [ClienteController::class, 'show']);
    Route::post('/clientes', [ClienteController::class, 'store']);
});

Route::middleware(['auth:sanctum', 'role:admin,super_admin'])->group(function () {
    Route::put('/clientes/{cliente}', [ClienteController::class, 'update']);
    Route::delete('/clientes/{cliente}', [ClienteController::class, 'destroy']);
});