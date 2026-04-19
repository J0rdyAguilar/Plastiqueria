<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductoImagen extends Model
{
    protected $table = 'producto_imagenes';

    protected $fillable = [
        'producto_id',
        'url',
        'es_principal',
        'orden',
        'creado_en',
    ];

    protected $casts = [
        'producto_id' => 'integer',
        'es_principal' => 'boolean',
        'orden' => 'integer',
        'creado_en' => 'datetime',
    ];

    const CREATED_AT = 'creado_en';
    const UPDATED_AT = null;

    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id');
    }
}