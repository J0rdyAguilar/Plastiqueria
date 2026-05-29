<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ventas_tienda', function (Blueprint $table) {
            if (!Schema::hasColumn('ventas_tienda', 'monto_variable_estado')) {
                $table->string('monto_variable_estado', 20)->nullable()->after('saldo_pendiente');
            }

            if (!Schema::hasColumn('ventas_tienda', 'monto_variable_aprobado_por')) {
                $table->unsignedBigInteger('monto_variable_aprobado_por')->nullable()->after('monto_variable_estado');
            }

            if (!Schema::hasColumn('ventas_tienda', 'monto_variable_aprobado_en')) {
                $table->dateTime('monto_variable_aprobado_en')->nullable()->after('monto_variable_aprobado_por');
            }
        });

        Schema::table('ventas_tienda_detalles', function (Blueprint $table) {
            if (!Schema::hasColumn('ventas_tienda_detalles', 'producto_precio_id')) {
                $table->unsignedBigInteger('producto_precio_id')->nullable()->after('producto_id');
            }

            if (!Schema::hasColumn('ventas_tienda_detalles', 'presentacion')) {
                $table->string('presentacion', 100)->nullable()->after('producto_precio_id');
            }

            if (!Schema::hasColumn('ventas_tienda_detalles', 'cantidad_base')) {
                $table->decimal('cantidad_base', 12, 4)->nullable()->after('cantidad');
            }

            if (!Schema::hasColumn('ventas_tienda_detalles', 'es_monto_variable')) {
                $table->boolean('es_monto_variable')->default(false)->after('subtotal');
            }
        });
    }

    public function down(): void
    {
        Schema::table('ventas_tienda', function (Blueprint $table) {
            if (Schema::hasColumn('ventas_tienda', 'monto_variable_estado')) {
                $table->dropColumn('monto_variable_estado');
            }

            if (Schema::hasColumn('ventas_tienda', 'monto_variable_aprobado_por')) {
                $table->dropColumn('monto_variable_aprobado_por');
            }

            if (Schema::hasColumn('ventas_tienda', 'monto_variable_aprobado_en')) {
                $table->dropColumn('monto_variable_aprobado_en');
            }
        });

        Schema::table('ventas_tienda_detalles', function (Blueprint $table) {
            if (Schema::hasColumn('ventas_tienda_detalles', 'producto_precio_id')) {
                $table->dropColumn('producto_precio_id');
            }

            if (Schema::hasColumn('ventas_tienda_detalles', 'presentacion')) {
                $table->dropColumn('presentacion');
            }

            if (Schema::hasColumn('ventas_tienda_detalles', 'cantidad_base')) {
                $table->dropColumn('cantidad_base');
            }

            if (Schema::hasColumn('ventas_tienda_detalles', 'es_monto_variable')) {
                $table->dropColumn('es_monto_variable');
            }
        });
    }
};
