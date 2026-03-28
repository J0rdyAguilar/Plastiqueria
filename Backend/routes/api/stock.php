<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\StockController;

// Lectura de stock: admin, super_admin y vendedor
Route::middleware(['auth:sanctum', 'role:admin,super_admin,vendedor'])->group(function () {
    Route::get('/stock', [StockController::class, 'index']);
});

// Escritura/gestión de stock: solo admin y super_admin
Route::middleware(['auth:sanctum', 'role:admin,super_admin'])->group(function () {
    // Si luego agregas acciones de gestión directa, van aquí
});