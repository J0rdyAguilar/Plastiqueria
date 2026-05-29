<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ClienteController;

/*
|--------------------------------------------------------------------------
| Rutas de clientes
|--------------------------------------------------------------------------
| Si ya tienes un Route::prefix('v1')->middleware('auth:sanctum')->group(...)
| en routes/api.php, copia SOLO las rutas de adentro.
*/

Route::prefix('v1')
    ->middleware(['auth:sanctum'])
    ->group(function () {
        Route::middleware(['role:admin,super_admin,vendedor,vendedor-tienda'])->group(function () {
            Route::get('/clientes', [ClienteController::class, 'index']);
            Route::get('/clientes/{cliente}', [ClienteController::class, 'show']);
            Route::post('/clientes', [ClienteController::class, 'store']);
        });

        Route::middleware(['role:admin,super_admin'])->group(function () {
            Route::put('/clientes/{cliente}', [ClienteController::class, 'update']);
            Route::delete('/clientes/{cliente}', [ClienteController::class, 'destroy']);
        });
    });
