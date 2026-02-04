<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ProductoImagenController;

Route::get('/', [ProductoImagenController::class, 'index']);
Route::post('/', [ProductoImagenController::class, 'store']);
Route::get('{productoImagen}', [ProductoImagenController::class, 'show']);
Route::put('{productoImagen}', [ProductoImagenController::class, 'update']);
Route::delete('{productoImagen}', [ProductoImagenController::class, 'destroy']);
