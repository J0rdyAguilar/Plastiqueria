<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ProductoController;

Route::middleware('auth:sanctum')->group(function () {

    // CRUD Productos
    Route::get('/', [ProductoController::class, 'index']);
    Route::post('/', [ProductoController::class, 'store']);
    Route::get('{producto}', [ProductoController::class, 'show']);
    Route::put('{producto}', [ProductoController::class, 'update']);
    Route::delete('{producto}', [ProductoController::class, 'destroy']);

    // Catálogo (para pedidos)
    Route::get('catalogo/lista', [ProductoController::class, 'catalogo']);

});
