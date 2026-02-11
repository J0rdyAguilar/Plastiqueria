<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Ubicacion extends Model
{
    protected $table = 'ubicaciones';

    // Tus columnas de timestamps no son created_at/updated_at
    const CREATED_AT = 'creado_en';
    const UPDATED_AT = 'actualizado_en';

    protected $fillable = [
        'nombre',
        'tipo',
        'direccion',
        'activa',
    ];

    protected $casts = [
        'activa' => 'boolean',
    ];
}
