<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ProductoController;

// Lectura: admin, super_admin y vendedor
Route::middleware(['auth:sanctum', 'role:admin,super_admin,vendedor'])->group(function () {
    Route::get('/', [ProductoController::class, 'index']);
    Route::get('/catalogo', [ProductoController::class, 'catalogo']);
    Route::get('/{producto}', [ProductoController::class, 'show']);
});

// Escritura: solo admin y super_admin
Route::middleware(['auth:sanctum', 'role:admin,super_admin'])->group(function () {
    Route::post('/', [ProductoController::class, 'store']);
    Route::put('/{producto}', [ProductoController::class, 'update']);
    Route::delete('/{producto}', [ProductoController::class, 'destroy']);
});