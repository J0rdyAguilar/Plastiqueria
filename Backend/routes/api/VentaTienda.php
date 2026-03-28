<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\VentaTiendaController;

Route::middleware(['auth:sanctum', 'role:vendedor_tienda,admin,super_admin'])->group(function () {
    Route::get('/ventas-tienda', [VentaTiendaController::class, 'index']);
    Route::post('/ventas-tienda', [VentaTiendaController::class, 'store']);
});