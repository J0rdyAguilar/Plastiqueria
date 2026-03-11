<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\VentaController;

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/ventas/pedido-vendedor', [VentaController::class, 'storePedidoVendedor']);
});