<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Producto extends Model
{
    use HasFactory;

    protected $table = 'productos';

    /**
     * Campos asignables
     */
    protected $fillable = [
        'sku',
        'nombre',
        'descripcion',
        'activo',
        'unidad_base',    // enum tipo_unidad
        'alerta_stock',
        'creado_en',
        'actualizado_en',
    ];

    /**
     * Casts
     */
    protected $casts = [
        'activo'        => 'boolean',
        'alerta_stock'  => 'integer',
        'creado_en'     => 'datetime',
        'actualizado_en'=> 'datetime',
    ];

    /**
     * Laravel NO usa created_at / updated_at
     */
    public $timestamps = false;

    /* =========================
       RELACIONES
    ========================= */

    /**
     * Unidades del producto (unidad, docena, fardo)
     */
    public function unidades()
    {
        return $this->hasMany(
            ProductoUnidad::class,
            'producto_id',
            'id'
        );
    }

    /**
     * Precios del producto
     */
    public function precios()
    {
        return $this->hasMany(
            ProductoPrecio::class,
            'producto_id',
            'id'
        );
    }

    /**
     * Imágenes del producto
     */
    public function imagenes()
    {
        return $this->hasMany(
            ProductoImagen::class,
            'producto_id',
            'id'
        );
    }
    public function imagenPrincipal()
{
    return $this->hasOne(ProductoImagen::class, 'producto_id', 'id')
        ->where('es_principal', 1);
}
    /**
     * Stock del producto por ubicación
     */
   /* public function stock()
    {
        return $this->hasMany(
            Stock::class,
            'producto_id',
            'id'
        );
    }

    /**
     * Detalles de pedidos donde aparece este producto
     */
   /**  public function pedidoDetalles()
   * {
      *  return $this->hasMany(
      *      PedidoDetalle::class,
     *       'producto_id',
    *        'id'
   *     );
  *  } */
}
