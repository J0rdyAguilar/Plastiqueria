<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Producto extends Model
{
    use HasFactory;

    protected $table = 'productos';

    const CREATED_AT = 'creado_en';
    const UPDATED_AT = 'actualizado_en';

    protected $fillable = [
        'sku',
        'nombre',
        'descripcion',
        'unidad_base',
        'activo',
        'creado_en',
        'actualizado_en',
    ];

    protected $casts = [
        'activo'         => 'boolean',
        'creado_en'      => 'datetime',
        'actualizado_en' => 'datetime',
    ];

    public function precios(): HasMany
    {
        return $this->hasMany(ProductoPrecio::class, 'producto_id', 'id')
            ->orderByDesc('activo')
            ->orderBy('factor_base');
    }

    public function imagenPrincipal(): HasOne
    {
        return $this->hasOne(ProductoImagen::class, 'producto_id', 'id')
            ->where('es_principal', 1)
            ->orderBy('orden');
    }

    public function imagenes(): HasMany
    {
        return $this->hasMany(ProductoImagen::class, 'producto_id', 'id')
            ->orderBy('orden');
    }

    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }

    public function scopeBuscar($query, $q)
    {
        if (!$q) {
            return $query;
        }

        return $query->where(function ($qq) use ($q) {
            $qq->where('nombre', 'like', "%{$q}%")
               ->orWhere('sku', 'like', "%{$q}%");
        });
    }
}   