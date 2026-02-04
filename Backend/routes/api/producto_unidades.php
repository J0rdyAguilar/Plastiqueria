<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ProductoUnidadController;

Route::get('/', [ProductoUnidadController::class, 'index']);
Route::post('/', [ProductoUnidadController::class, 'store']);
Route::get('{productoUnidad}', [ProductoUnidadController::class, 'show']);
Route::put('{productoUnidad}', [ProductoUnidadController::class, 'update']);
Route::delete('{productoUnidad}', [ProductoUnidadController::class, 'destroy']);
