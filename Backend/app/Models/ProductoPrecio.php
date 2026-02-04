<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ProductoPrecio extends Model
{
    protected $table = 'producto_precios';

    protected $fillable = [
        'producto_id',
        'unidad',
        'canal',
        'precio_sugerido_1',
        'precio_sugerido_2',
        'precio_sugerido_3',
        'creado_en',
        'actualizado_en',
    ];

    protected $casts = [
        'precio_sugerido_1' => 'decimal:2',
        'precio_sugerido_2' => 'decimal:2',
        'precio_sugerido_3' => 'decimal:2',
        'creado_en' => 'datetime',
        'actualizado_en' => 'datetime',
    ];

    public $timestamps = false;


    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id', 'id');
    }
}
