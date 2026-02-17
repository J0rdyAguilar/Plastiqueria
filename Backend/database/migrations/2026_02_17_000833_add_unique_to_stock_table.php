<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock', function (Blueprint $table) {
            $table->unique(['producto_id', 'ubicacion_id']);
        });
    }

    public function down(): void
    {
        Schema::table('stock', function (Blueprint $table) {
            $table->dropUnique(['stock_producto_id_ubicacion_id_unique']);
        });
    }

};
