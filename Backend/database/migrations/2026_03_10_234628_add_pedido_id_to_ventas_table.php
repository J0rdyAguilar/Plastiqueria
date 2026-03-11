<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ventas', function (Blueprint $table) {
            $table->foreignId('pedido_id')
                ->nullable()
                ->after('id')
                ->constrained('pedidos')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('ventas', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pedido_id');
        });
    }
};