<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

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

    const CREATED_AT = 'creado_en';
    const UPDATED_AT = 'actualizado_en';

    public $timestamps = true;

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