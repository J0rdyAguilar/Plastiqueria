<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Verificar si el índice ya existe antes de crearlo
        $indexes = DB::select("SHOW INDEX FROM stock WHERE Key_name = 'stock_producto_id_ubicacion_id_unique'");

        if (empty($indexes)) {
            Schema::table('stock', function (Blueprint $table) {
                $table->unique(['producto_id', 'ubicacion_id'], 'stock_producto_id_ubicacion_id_unique');
            });
        }
    }

    public function down(): void
    {
        $indexes = DB::select("SHOW INDEX FROM stock WHERE Key_name = 'stock_producto_id_ubicacion_id_unique'");

        if (!empty($indexes)) {
            Schema::table('stock', function (Blueprint $table) {
                $table->dropUnique('stock_producto_id_ubicacion_id_unique');
            });
        }
    }
};