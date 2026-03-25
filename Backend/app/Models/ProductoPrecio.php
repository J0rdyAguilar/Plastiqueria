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

    public $timestamps = true;

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
        'factor_base'    => 'float',
        'precio'         => 'float',
        'activo'         => 'boolean',
        'creado_en'      => 'datetime',
        'actualizado_en' => 'datetime',
    ];

    protected static function booted()
    {
        static::created(function (ProductoPrecio $precio) {
            $ubicaciones = Ubicacion::query()->get(['id']);

            foreach ($ubicaciones as $u) {
                Stock::query()->firstOrCreate(
                    [
                        'producto_id' => $precio->producto_id,
                        'producto_precio_id' => $precio->id,
                        'ubicacion_id' => $u->id,
                    ],
                    [
                        'cantidad' => 0,
                        'cantidad_base' => 0,
                    ]
                );
            }
        });
    }

    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id', 'id');
    }

    public function stocks()
    {
        return $this->hasMany(Stock::class, 'producto_precio_id', 'id');
    }
}