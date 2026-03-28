<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Pedido extends Model
{
    use HasFactory;

    protected $table = 'pedidos';

    const CREATED_AT = 'creado_en';
    const UPDATED_AT = 'actualizado_en';

    protected $fillable = [
        'codigo',
        'ubicacion_id',
        'cliente_id',
        'vendedor_id',
        'ruta_id',
        'zona_id',
        'estado',
        'fecha_pedido',
        'observaciones',
        'total',
        'fecha_entrega',
        'entregado_en',
        'canal',
    ];

    protected $casts = [
        'ubicacion_id'   => 'int',
        'cliente_id'     => 'int',
        'vendedor_id'    => 'int',
        'ruta_id'        => 'int',
        'zona_id'        => 'int',
        'total'          => 'decimal:2',
        'fecha_pedido'   => 'date',
        'fecha_entrega'  => 'date',
        'entregado_en'   => 'datetime',
        'creado_en'      => 'datetime',
        'actualizado_en' => 'datetime',
    ];

    public function detalles()
    {
        return $this->hasMany(PedidoDetalle::class, 'pedido_id', 'id');
    }

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    public function vendedor()
    {
        return $this->belongsTo(Vendedor::class, 'vendedor_id');
    }

    public function ruta()
    {
        return $this->belongsTo(Ruta::class, 'ruta_id');
    }

    public function zona()
    {
        return $this->belongsTo(Zona::class, 'zona_id');
    }

    public function ubicacion()
    {
        return $this->belongsTo(Ubicacion::class, 'ubicacion_id');
    }

    public function rutero()
{
    return $this->belongsTo(Usuario::class, 'rutero_id');
}
}