<?php

use Illuminate\Support\Facades\Route;

require __DIR__.'/api/auth.php';
require __DIR__.'/api/usuarios.php';
require __DIR__.'/api/vendedores.php';
require __DIR__.'/api/rutas.php'; 
require __DIR__.'/api/caja.php';
require __DIR__.'/api/ubicaciones.php'; // ✅ NUEVO
require __DIR__ . '/api/zonas.php';
require __DIR__ . '/api/stock.php';
require __DIR__ . '/api/movimientos_stock.php';

Route::prefix('pedidos')
    ->middleware('auth:sanctum')
    ->group(base_path('routes/api/pedidos.php'));

Route::prefix('productos')
    ->middleware('auth:sanctum')
    ->group(base_path('routes/api/producto.php'));

Route::prefix('producto-unidades')
  ->middleware('auth:sanctum')
  ->group(base_path('routes/api/producto_unidades.php'));

  Route::prefix('producto-precios')
  ->middleware('auth:sanctum')
  ->group(base_path('routes/api/producto_precios.php'));

  Route::prefix('producto-imagenes')
  ->middleware('auth:sanctum')
  ->group(base_path('routes/api/producto_imagenes.php'));
