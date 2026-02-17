<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Stock extends Model
{
    protected $table = 'stock';

    // Tu tabla solo tiene actualizado_en (no creado_en)
    const CREATED_AT = null;
    const UPDATED_AT = 'actualizado_en';

    public $timestamps = true;

    protected $fillable = [
        'ubicacion_id',
        'producto_id',
        'cantidad_base',
    ];

    protected $casts = [
        'cantidad_base' => 'int',
        'actualizado_en' => 'datetime',
    ];

    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id');
    }

    public function ubicacion()
    {
        return $this->belongsTo(Ubicacion::class, 'ubicacion_id');
    }
}
