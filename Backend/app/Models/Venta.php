<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Venta extends Model
{
    protected $table = 'ventas';

    const CREATED_AT = 'creado_en';
    const UPDATED_AT = 'actualizado_en';

    protected $fillable = [
        'caja_id',
        'ubicacion_id',
        'usuario_id',
        'vendedor_id',
        'cliente_id',
        'ruta_id',
        'zona_id',
        'tipo_venta',
        'total',
        'efectivo',
        'cambio',
        'metodo_pago',
        'estado',
        'nota',
        'observaciones',
    ];
}