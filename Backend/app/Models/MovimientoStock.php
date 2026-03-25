<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MovimientoStock extends Model
{
    protected $table = 'movimientos_stock';

    const CREATED_AT = null;
    const UPDATED_AT = null;

    public $timestamps = false;

    protected $fillable = [
        'tipo',
        'ubicacion_origen_id',
        'ubicacion_destino_id',
        'producto_id',
        'producto_precio_id',
        'presentacion',
        'factor_aplicado',
        'cantidad',
        'cantidad_base',
        'motivo',
        'referencia_tipo',
        'referencia_id',
        'creado_por',
        'creado_en',
    ];

    protected $casts = [
        'factor_aplicado' => 'float',
        'cantidad' => 'integer',
        'cantidad_base' => 'integer',
        'creado_en' => 'datetime',
    ];

    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id', 'id');
    }

    public function productoPrecio()
    {
        return $this->belongsTo(ProductoPrecio::class, 'producto_precio_id', 'id');
    }
}