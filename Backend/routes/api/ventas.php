<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\VentaController;

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/ventas/pedido-vendedor', [VentaController::class, 'storePedidoVendedor']);

    Route::get('/ventas/pedidos-vendedor', [VentaController::class, 'indexPedidosVendedor']);

    Route::get('/ventas/pedidos-admin', [VentaController::class, 'indexPedidosAdmin']);
    Route::put('/ventas/{venta}/actualizar-admin', [VentaController::class, 'actualizarPedidoAdmin']);
    Route::post('/ventas/{venta}/aprobar', [VentaController::class, 'aprobarPedidoAdmin']);
    Route::post('/ventas/{venta}/preparar', [VentaController::class, 'prepararPedidoAdmin']);
    Route::post('/ventas/{venta}/entregar', [VentaController::class, 'entregarPedidoAdmin']);
});