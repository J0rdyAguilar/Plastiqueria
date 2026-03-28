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

    // Si usas timestamps personalizados
    const CREATED_AT = 'creado_en';
    const UPDATED_AT = 'actualizado_en';

    protected $fillable = [
        'sku',
        'nombre',
        'descripcion',
        'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    /* =========================================================
       RELACIONES
    ========================================================= */

    /**
     * Precios por presentación (unidad, caja, etc)
     * productos.id -> producto_precios.producto_id
     */
    public function precios(): HasMany
    {
        return $this->hasMany(ProductoPrecio::class, 'producto_id');
    }

    /**
     * Imagen principal del producto
     */
    public function imagenPrincipal(): HasOne
    {
        return $this->hasOne(ProductoImagen::class, 'producto_id')
            ->where('es_principal', 1)
            ->orderBy('orden');
    }

    /**
     * Todas las imágenes
     */
    public function imagenes(): HasMany
    {
        return $this->hasMany(ProductoImagen::class, 'producto_id')
            ->orderBy('orden');
    }

    /**
     * Stock en diferentes ubicaciones
     */
    public function stocks(): HasMany
    {
        return $this->hasMany(Stock::class, 'producto_id');
    }

    /* =========================================================
       SCOPES
    ========================================================= */

    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }

    public function scopeBuscar($query, $q)
    {
        if (!$q) return $query;

        return $query->where(function ($qq) use ($q) {
            $qq->where('nombre', 'like', "%{$q}%")
               ->orWhere('sku', 'like', "%{$q}%");
        });
    }
}