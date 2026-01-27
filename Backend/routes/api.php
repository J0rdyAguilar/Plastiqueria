<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\UsuarioController;

Route::apiResource('usuarios', UsuarioController::class);


use App\Http\Controllers\Api\AuthController;

Route::post('login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::apiResource('usuarios', \App\Http\Controllers\Api\UsuarioController::class);
});
