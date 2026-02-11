<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MovimientoStock extends Model
{
    protected $table = 'movimientos_stock';

    const CREATED_AT = 'creado_en';
    const UPDATED_AT = null;

    public $timestamps = true;

    protected $fillable = [
        'tipo',
        'ubicacion_origen_id',
        'ubicacion_destino_id',
        'producto_id',
        'cantidad_base',
        'motivo',
        'referencia_tipo',
        'referencia_id',
        'creado_por',
    ];

    protected $casts = [
        'cantidad_base' => 'integer',
        'referencia_id' => 'integer',
        'creado_por' => 'integer',
    ];
}
