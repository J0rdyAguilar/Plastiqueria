<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\Stock;
use App\Models\Ubicacion;

class Producto extends Model
{
    use HasFactory;

    protected $table = 'productos';

    protected $fillable = [
        'sku',
        'nombre',
        'descripcion',
        'activo',
        'unidad_base',
        'alerta_stock',
        'creado_en',
        'actualizado_en',
    ];

    protected $casts = [
        'activo'         => 'boolean',
        'alerta_stock'   => 'integer',
        'creado_en'      => 'datetime',
        'actualizado_en' => 'datetime',
    ];

    public $timestamps = false;

    /**
     * AUTO-CREAR STOCK EN 0 PARA TODAS LAS UBICACIONES
     */
    protected static function booted()
    {
        static::created(function (Producto $producto) {
            $ubicaciones = Ubicacion::query()->get(['id']);

            foreach ($ubicaciones as $u) {
                Stock::query()->firstOrCreate(
                    [
                        'producto_id'  => $producto->id,
                        'ubicacion_id' => $u->id,
                    ],
                    [
                        'cantidad_base' => 0,
                    ]
                );
            }
        });
    }

    /* =========================
       RELACIONES
    ========================= */

    public function unidades()
    {
        return $this->hasMany(ProductoUnidad::class, 'producto_id', 'id');
    }

    public function precios()
    {
        return $this->hasMany(ProductoPrecio::class, 'producto_id', 'id');
    }

    public function imagenes()
    {
        return $this->hasMany(ProductoImagen::class, 'producto_id', 'id');
    }

    public function imagenPrincipal()
    {
        return $this->hasOne(ProductoImagen::class, 'producto_id', 'id')
            ->where('es_principal', 1);
    }

    public function stocks()
    {
        return $this->hasMany(Stock::class, 'producto_id', 'id');
    }
}
