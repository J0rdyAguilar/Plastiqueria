<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class VentaTienda extends Model
{
    use HasFactory;

    protected $table = 'ventas_tienda';

    const CREATED_AT = 'creado_en';
    const UPDATED_AT = null;

    protected $fillable = [
        'ubicacion_id',
        'usuario_id',
        'cliente_id',
        'estado',
        'metodo_pago',
        'referencia_pago',
        'subtotal',
        'descuento',
        'total',
        'saldo_pendiente',
    ];

    protected $casts = [
        'ubicacion_id'    => 'integer',
        'usuario_id'      => 'integer',
        'cliente_id'      => 'integer',
        'subtotal'        => 'decimal:2',
        'descuento'       => 'decimal:2',
        'total'           => 'decimal:2',
        'saldo_pendiente' => 'decimal:2',
        'creado_en'       => 'datetime',
    ];

    public function detalles()
    {
        return $this->hasMany(VentaTiendaDetalle::class, 'venta_id', 'id');
    }

    public function ubicacion()
    {
        return $this->belongsTo(Ubicacion::class, 'ubicacion_id', 'id');
    }

    public function usuario()
    {
        return $this->belongsTo(Usuario::class, 'usuario_id', 'id');
    }

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id', 'id');
    }

    public function cuotas()
    {
        return $this->hasMany(Cuota::class, 'origen_id', 'id')
            ->where('origen_tipo', 'venta_tienda');
    }
}