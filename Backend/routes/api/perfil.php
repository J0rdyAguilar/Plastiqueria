<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\PerfilController;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/perfil', [PerfilController::class, 'show']);
    Route::post('/perfil/actualizar', [PerfilController::class, 'update']);
    Route::post('/perfil/cambiar-password', [PerfilController::class, 'changePassword']);
});