<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\StockController;

Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/stock', [StockController::class, 'index']);
});
