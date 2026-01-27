<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\UsuarioController;

Route::prefix('v1')
  ->middleware(['auth:sanctum'])
  ->group(function () {
      Route::apiResource('usuarios', UsuarioController::class);
  });
