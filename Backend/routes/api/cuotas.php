<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\CuotaController;

Route::get('/', [CuotaController::class, 'index']);
Route::get('/{id}', [CuotaController::class, 'show']);
Route::post('/{id}/abonar', [CuotaController::class, 'abonar']);