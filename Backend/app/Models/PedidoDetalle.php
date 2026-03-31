<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PedidoDetalle extends Model
{
    protected $table = 'pedido_detalles';

    const CREATED_AT = 'creado_en';
    const UPDATED_AT = null;

    public $timestamps = true;

    protected $fillable = [
        'pedido_id',
        'producto_id',
        'presentacion',
        'cantidad',
        'cantidad_base',
        'precio_unitario',
        'subtotal',
        'es_monto_variable',
    ];

    protected $casts = [
        'pedido_id'         => 'int',
        'producto_id'       => 'int',
        'cantidad'          => 'float',
        'cantidad_base'     => 'int',
        'precio_unitario'   => 'decimal:2',
        'subtotal'          => 'decimal:2',
        'es_monto_variable' => 'bool',
        'creado_en'         => 'datetime',
    ];

    public function pedido()
    {
        return $this->belongsTo(Pedido::class, 'pedido_id');
    }

    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id');
    }
}