<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\UbicacionController;

// Sin v1
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/ubicaciones', [UbicacionController::class, 'index']);
    Route::post('/ubicaciones', [UbicacionController::class, 'store']);
    Route::get('/ubicaciones/{ubicacion}', [UbicacionController::class, 'show']);
    Route::match(['put', 'patch'], '/ubicaciones/{ubicacion}', [UbicacionController::class, 'update']);
    Route::patch('/ubicaciones/{ubicacion}/toggle', [UbicacionController::class, 'toggle']);
    Route::delete('/ubicaciones/{ubicacion}', [UbicacionController::class, 'destroy']);
});

// Con v1
Route::prefix('v1')->middleware(['auth:sanctum'])->group(function () {
    Route::get('/ubicaciones', [UbicacionController::class, 'index']);
    Route::post('/ubicaciones', [UbicacionController::class, 'store']);
    Route::get('/ubicaciones/{ubicacion}', [UbicacionController::class, 'show']);
    Route::match(['put', 'patch'], '/ubicaciones/{ubicacion}', [UbicacionController::class, 'update']);
    Route::patch('/ubicaciones/{ubicacion}/toggle', [UbicacionController::class, 'toggle']);
    Route::delete('/ubicaciones/{ubicacion}', [UbicacionController::class, 'destroy']);
});