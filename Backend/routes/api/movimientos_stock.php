<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\MovimientoStockController;

Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/movimientos-stock', [MovimientoStockController::class, 'index']);
    Route::post('/movimientos-stock', [MovimientoStockController::class, 'store']);
});
