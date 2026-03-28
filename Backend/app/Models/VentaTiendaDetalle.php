<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VentaTiendaDetalle extends Model
{
    protected $table = 'venta_tienda_detalles';

    public $timestamps = false;

    protected $fillable = [
        'venta_id',
        'producto_id',
        'cantidad',
        'precio_unitario',
        'subtotal',
    ];
}