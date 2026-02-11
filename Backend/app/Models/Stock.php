<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Stock extends Model
{
    protected $table = 'stock';

    // Solo tienes actualizado_en (no creado_en)
    const CREATED_AT = null;
    const UPDATED_AT = 'actualizado_en';

    public $timestamps = true;

    protected $fillable = [
        'ubicacion_id',
        'producto_id',
        'cantidad_base',
    ];

    protected $casts = [
        'cantidad_base' => 'integer',
    ];
}
