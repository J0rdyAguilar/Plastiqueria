<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VentaDetalle extends Model
{
    protected $table = 'venta_detalles';

    const CREATED_AT = 'creado_en';
    const UPDATED_AT = null;

    protected $fillable = [
        'venta_id',
        'producto_id',
        'presentacion',
        'cantidad_base',
        'precio_unitario',
        'subtotal',
        'es_monto_variable',
    ];

    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id');
    }

    public function venta()
    {
        return $this->belongsTo(Venta::class, 'venta_id');
    }
}