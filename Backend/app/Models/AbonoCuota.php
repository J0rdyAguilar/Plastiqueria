<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AbonoCuota extends Model
{
    protected $table = 'abonos_cuotas';

    const CREATED_AT = 'creado_en';
    const UPDATED_AT = null;

    public $timestamps = false;

    protected $fillable = [
        'cuota_id',
        'caja_id',
        'ubicacion_id',
        'cliente_id',
        'usuario_id',
        'monto',
        'metodo_pago',
        'referencia_pago',
        'observaciones',
        'fecha_pago',
    ];

    protected $casts = [
        'cuota_id'         => 'integer',
        'caja_id'          => 'integer',
        'ubicacion_id'     => 'integer',
        'cliente_id'       => 'integer',
        'usuario_id'       => 'integer',
        'monto'            => 'decimal:2',
        'fecha_pago'       => 'datetime',
        'creado_en'        => 'datetime',
    ];

    public function cuota()
    {
        return $this->belongsTo(Cuota::class, 'cuota_id');
    }

    public function caja()
    {
        return $this->belongsTo(Caja::class, 'caja_id');
    }

    public function ubicacion()
    {
        return $this->belongsTo(Ubicacion::class, 'ubicacion_id');
    }

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    public function usuario()
    {
        return $this->belongsTo(Usuario::class, 'usuario_id');
    }
}