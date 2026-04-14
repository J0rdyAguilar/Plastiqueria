<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\Stock;
use App\Models\Producto;

class ProductoPrecio extends Model
{
    use HasFactory;

    protected $table = 'producto_precios';

    const CREATED_AT = 'creado_en';
    const UPDATED_AT = 'actualizado_en';

    public $timestamps = true;

    protected $fillable = [
        'producto_id',
        'presentacion',
        'factor_base',
        'precio_costo',
        'precio_venta',
        'activo',
        'creado_en',
        'actualizado_en',
    ];

    protected $casts = [
        'producto_id'    => 'integer',
        'factor_base'    => 'float',
        'precio_costo'   => 'float',
        'precio_venta'   => 'float',
        'activo'         => 'boolean',
        'creado_en'      => 'datetime',
        'actualizado_en' => 'datetime',
    ];

    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id', 'id');
    }

    public function stocks()
    {
        return $this->hasMany(Stock::class, 'producto_precio_id', 'id');
    }
}