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

    protected $casts = [
        'venta_id'        => 'integer',
        'producto_id'     => 'string',
        'cantidad'        => 'decimal:4',
        'precio_unitario' => 'decimal:2',
        'subtotal'        => 'decimal:2',
    ];

    public function venta()
    {
        return $this->belongsTo(VentaTienda::class, 'venta_id', 'id');
    }

    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id', 'id');
    }
}