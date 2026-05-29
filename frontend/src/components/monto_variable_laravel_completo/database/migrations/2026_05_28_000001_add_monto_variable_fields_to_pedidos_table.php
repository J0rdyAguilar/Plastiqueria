<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            if (!Schema::hasColumn('pedidos', 'monto_variable_estado')) {
                $table->string('monto_variable_estado', 20)->nullable()->after('canal');
            }

            if (!Schema::hasColumn('pedidos', 'monto_variable_aprobado_por')) {
                $table->unsignedBigInteger('monto_variable_aprobado_por')->nullable()->after('monto_variable_estado');
            }

            if (!Schema::hasColumn('pedidos', 'monto_variable_aprobado_en')) {
                $table->dateTime('monto_variable_aprobado_en')->nullable()->after('monto_variable_aprobado_por');
            }
        });

        Schema::table('pedido_detalles', function (Blueprint $table) {
            if (!Schema::hasColumn('pedido_detalles', 'es_monto_variable')) {
                $table->boolean('es_monto_variable')->default(false)->after('subtotal');
            }
        });
    }

    public function down(): void
    {
        Schema::table('pedidos', function (Blueprint $table) {
            if (Schema::hasColumn('pedidos', 'monto_variable_estado')) {
                $table->dropColumn('monto_variable_estado');
            }

            if (Schema::hasColumn('pedidos', 'monto_variable_aprobado_por')) {
                $table->dropColumn('monto_variable_aprobado_por');
            }

            if (Schema::hasColumn('pedidos', 'monto_variable_aprobado_en')) {
                $table->dropColumn('monto_variable_aprobado_en');
            }
        });

        Schema::table('pedido_detalles', function (Blueprint $table) {
            if (Schema::hasColumn('pedido_detalles', 'es_monto_variable')) {
                $table->dropColumn('es_monto_variable');
            }
        });
    }
};
