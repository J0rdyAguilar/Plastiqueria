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
        'cliente_id',
        'vendedor_id',
        'estado',
        'fecha_pedido',
        'notas',
        'fecha_entrega',
        'entregado_en',
        'canal',
    ];

    protected $casts = [
        'fecha_pedido'  => 'date',
        'fecha_entrega' => 'date',
        'entregado_en'  => 'datetime',
        'creado_en'     => 'datetime',
        'actualizado_en'=> 'datetime',
    ];

    // =========================
    // Relaciones
    // =========================

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
        return $this->belongsTo(Usuario::class, 'vendedor_id');
        // Si tu vendedor es otra tabla (Vendedor.php), lo cambiamos.
        // return $this->belongsTo(Vendedor::class, 'vendedor_id');
    }
}
