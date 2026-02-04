<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ProductoPrecioController;

Route::get('/', [ProductoPrecioController::class, 'index']);
Route::post('/', [ProductoPrecioController::class, 'store']);
Route::get('{productoPrecio}', [ProductoPrecioController::class, 'show']);
Route::put('{productoPrecio}', [ProductoPrecioController::class, 'update']);
Route::delete('{productoPrecio}', [ProductoPrecioController::class, 'destroy']);
