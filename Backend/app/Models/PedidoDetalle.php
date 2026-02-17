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
        'unidad',
        'cantidad',
        'cantidad_base',
        'precio_variable',
        'precio_sugerido_1',
        'precio_sugerido_2',
        'precio_sugerido_3',
        'precio_unitario',
        'total_linea',
    ];

    protected $casts = [
        'cantidad'          => 'int',
        'cantidad_base'     => 'int',
        'precio_variable'   => 'bool',
        'precio_sugerido_1' => 'decimal:2',
        'precio_sugerido_2' => 'decimal:2',
        'precio_sugerido_3' => 'decimal:2',
        'precio_unitario'   => 'decimal:2',
        'total_linea'       => 'decimal:2',
        'creado_en'         => 'datetime',
    ];

    // =========================
    // Relaciones
    // =========================

    public function pedido()
    {
        return $this->belongsTo(Pedido::class, 'pedido_id');
    }

    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id');
    }
}
