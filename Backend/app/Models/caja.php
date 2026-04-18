<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Caja extends Model
{
    protected $table = 'cajas';

    public $timestamps = false;

    protected $fillable = [
        'abierto_por',
        'ubicacion_id',
        'abierto_en',
        'cerrado_en',
        'efectivo_inicial',
        'efectivo_final',
        'notas',
    ];

    protected $casts = [
        'abierto_en' => 'datetime',
        'cerrado_en' => 'datetime',
        'efectivo_inicial' => 'decimal:2',
        'efectivo_final' => 'decimal:2',
        'ubicacion_id' => 'integer',
        'abierto_por' => 'integer',
    ];

    public function ubicacion()
    {
        return $this->belongsTo(Ubicacion::class, 'ubicacion_id', 'id');
    }

    public function usuarioApertura()
    {
        return $this->belongsTo(Usuario::class, 'abierto_por', 'id');
    }

    public function movimientos()
    {
        return $this->hasMany(MovimientoCaja::class, 'caja_id', 'id');
    }

    public function abonosCuotas()
    {
        return $this->hasMany(AbonoCuota::class, 'caja_id', 'id');
    }
}