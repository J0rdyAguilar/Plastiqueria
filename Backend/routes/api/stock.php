<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\StockController;

// Lectura de stock
Route::middleware(['auth:sanctum', 'role:admin,super_admin,vendedor,vendedor-tienda,rutero,admin_bodega,administrador_de_bodega'])
    ->group(function () {
        Route::get('/stock', [StockController::class, 'index']);
    });

// Escritura/gestión directa de stock
Route::middleware(['auth:sanctum', 'role:admin,super_admin,admin_bodega,administrador_de_bodega'])
    ->group(function () {
        // futuras rutas aquí
    });