<?php

namespace App\Models;
// GET /api/v1/caja/actual?ubicacion_id=1
use Illuminate\Database\Eloquent\Model;

class Ubicacion extends Model
{
    protected $table = 'ubicaciones';

    protected $fillable = [
        'nombre',
        'activo',
    ];

    public $timestamps = false;
}
