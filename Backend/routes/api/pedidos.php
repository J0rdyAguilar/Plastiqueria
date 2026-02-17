<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\PedidoController;

Route::get('/', [PedidoController::class, 'index']);
Route::post('/', [PedidoController::class, 'store']);

Route::post('/{pedido}/enviar', [PedidoController::class, 'enviar']);
Route::post('/{pedido}/aprobar', [PedidoController::class, 'aprobar']);
Route::post('/{pedido}/preparar', [PedidoController::class, 'preparar']);
Route::post('/{pedido}/entregar', [PedidoController::class, 'entregar']);
