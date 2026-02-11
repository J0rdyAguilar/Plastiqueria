<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\UbicacionController;

// Si ya proteges con auth:sanctum en api.php, aquí no lo repitas.
// Si no, descomenta el middleware.
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/ubicaciones', [UbicacionController::class, 'index']);
    Route::post('/ubicaciones', [UbicacionController::class, 'store']);
    Route::get('/ubicaciones/{ubicacion}', [UbicacionController::class, 'show']);
    Route::match(['put', 'patch'], '/ubicaciones/{ubicacion}', [UbicacionController::class, 'update']);
    Route::patch('/ubicaciones/{ubicacion}/toggle', [UbicacionController::class, 'toggle']);
});
