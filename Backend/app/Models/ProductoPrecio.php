<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ProductoPrecio extends Model
{
    use HasFactory;

    protected $table = 'producto_precios';

    public $timestamps = false;

    protected $fillable = [
        'producto_id',
        'presentacion',
        'factor_base',
        'precio',
        'activo',
        'creado_en',
        'actualizado_en',
    ];

    protected $casts = [
        'factor_base' => 'float',
        'precio' => 'float',
        'activo' => 'boolean',
        'creado_en' => 'datetime',
        'actualizado_en' => 'datetime',
    ];

    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id', 'id');
    }
}