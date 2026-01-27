<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Caja extends Model
{
    protected $table = 'cajas';

    public $timestamps = false; // porque tus columnas son abierto_en/cerrado_en

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
    ];
}
