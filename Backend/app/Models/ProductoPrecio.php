<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ProductoPrecio extends Model
{
    use HasFactory;

    protected $table = 'producto_precios';

    const CREATED_AT = 'creado_en';
    const UPDATED_AT = 'actualizado_en';

    protected $fillable = [
        'producto_id',
        'presentacion',
        'factor_base',
        'precio_costo',
        'precio_venta',
        'precio_ruta',
        'activo',
        'creado_en',
        'actualizado_en',
    ];

    protected $casts = [
        'producto_id'    => 'integer',
        'factor_base'    => 'decimal:4',
        'precio_costo'   => 'decimal:2',
        'precio_venta'   => 'decimal:2',
        'precio_ruta'    => 'decimal:2',
        'activo'         => 'boolean',
        'creado_en'      => 'datetime',
        'actualizado_en' => 'datetime',
    ];

    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id', 'id');
    }
}
