<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\DashboardController;

Route::middleware(['auth:sanctum', 'role:admin,super_admin'])->group(function () {
    Route::get('/dashboard/resumen', [DashboardController::class, 'resumen']);
});