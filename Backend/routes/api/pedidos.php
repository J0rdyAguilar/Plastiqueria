<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\PedidoController;

// SOLO super_admin - montos variables
Route::middleware(['role:super_admin'])->group(function () {
    Route::get('/montos-variables/pendientes', [PedidoController::class, 'montosVariablesPendientes']);
    Route::post('/{pedido}/aprobar-monto-variable', [PedidoController::class, 'aprobarMontoVariable']);
    Route::post('/{pedido}/rechazar-monto-variable', [PedidoController::class, 'rechazarMontoVariable']);
});

// vendedor, bodega y super_admin
Route::middleware(['role:admin_bodega,super_admin,vendedor'])->group(function () {
    Route::get('/mis-pedidos', [PedidoController::class, 'misPedidos']);
    Route::get('/', [PedidoController::class, 'index']);
    Route::post('/', [PedidoController::class, 'store']);
    Route::post('/{pedido}/enviar', [PedidoController::class, 'enviar']);
});

// SOLO bodega y super_admin
Route::middleware(['role:admin_bodega,super_admin'])->group(function () {
    Route::put('/{pedido}', [PedidoController::class, 'update']);
    Route::post('/{pedido}/aprobar', [PedidoController::class, 'aprobar']);
    Route::post('/{pedido}/preparar', [PedidoController::class, 'preparar']);
    Route::post('/{pedido}/asignar-rutero', [PedidoController::class, 'asignarRutero']);
});

// rutero y super_admin
Route::middleware(['role:rutero,super_admin'])->group(function () {
    Route::get('/rutero/mis-pedidos', [PedidoController::class, 'misPedidosRutero']);
    Route::get('/mis-entregas', [PedidoController::class, 'misEntregas']);
    Route::post('/{pedido}/entregar', [PedidoController::class, 'entregar']);
});