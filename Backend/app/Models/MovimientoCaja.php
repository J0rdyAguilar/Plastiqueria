<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MovimientoCaja extends Model
{
    protected $table = 'movimientos_caja';

    const CREATED_AT = 'creado_en';
    const UPDATED_AT = null;

    protected $fillable = [
        'caja_id',
        'ubicacion_id',
        'usuario_id',
        'tipo',
        'concepto',
        'monto',
        'metodo_pago',
        'referencia_id',
        'referencia_tipo',
        'notas',
    ];

    protected $casts = [
        'caja_id' => 'integer',
        'ubicacion_id' => 'integer',
        'usuario_id' => 'integer',
        'monto' => 'decimal:2',
        'referencia_id' => 'integer',
        'creado_en' => 'datetime',
    ];

    public function caja()
    {
        return $this->belongsTo(Caja::class, 'caja_id', 'id');
    }

    public function ubicacion()
    {
        return $this->belongsTo(Ubicacion::class, 'ubicacion_id', 'id');
    }

    public function usuario()
    {
        return $this->belongsTo(Usuario::class, 'usuario_id', 'id');
    }
}