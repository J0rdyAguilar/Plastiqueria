<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Stock extends Model
{
    protected $table = 'stock';

    const CREATED_AT = null;
    const UPDATED_AT = 'actualizado_en';

    public $timestamps = true;

    protected $fillable = [
        'ubicacion_id',
        'producto_id',
        'producto_precio_id',
        'cantidad',
        'cantidad_base',
    ];

    protected $casts = [
        'cantidad' => 'int',
        'cantidad_base' => 'int',
        'actualizado_en' => 'datetime',
    ];

    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id', 'id');
    }

    public function productoPrecio()
    {
        return $this->belongsTo(ProductoPrecio::class, 'producto_precio_id', 'id');
    }

    public function ubicacion()
    {
        return $this->belongsTo(Ubicacion::class, 'ubicacion_id', 'id');
    }
}