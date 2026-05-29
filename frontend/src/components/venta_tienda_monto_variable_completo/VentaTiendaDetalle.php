<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VentaTiendaDetalle extends Model
{
    protected $table = 'ventas_tienda_detalles';

    const CREATED_AT = 'creado_en';
    const UPDATED_AT = null;

    public $timestamps = true;

    protected $fillable = [
        'venta_id',
        'producto_id',
        'producto_precio_id',
        'presentacion',
        'cantidad',
        'cantidad_base',
        'precio_unitario',
        'subtotal',
        'es_monto_variable',
    ];

    protected $casts = [
        'venta_id'          => 'integer',
        'producto_id'       => 'integer',
        'producto_precio_id'=> 'integer',
        'cantidad'          => 'decimal:4',
        'cantidad_base'     => 'decimal:4',
        'precio_unitario'   => 'decimal:2',
        'subtotal'          => 'decimal:2',
        'es_monto_variable' => 'boolean',
        'creado_en'         => 'datetime',
    ];

    public function venta()
    {
        return $this->belongsTo(VentaTienda::class, 'venta_id', 'id');
    }

    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id', 'id');
    }

    public function productoPrecio()
    {
        return $this->belongsTo(ProductoPrecio::class, 'producto_precio_id', 'id');
    }
}
