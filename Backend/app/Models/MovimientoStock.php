<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class MovimientoStock extends Model
{
    use HasFactory;

    protected $table = 'movimientos_stock';

    const CREATED_AT = null;
    const UPDATED_AT = null;

    public $timestamps = false;

    protected $fillable = [
        'tipo',
        'ubicacion_origen_id',
        'ubicacion_destino_id',
        'producto_id',
        'producto_precio_id',
        'presentacion',
        'factor_aplicado',
        'cantidad',
        'cantidad_base',
        'motivo',
        'referencia_tipo',
        'referencia_id',
        'creado_por',
        'creado_en',
    ];

    protected $casts = [
        'ubicacion_origen_id' => 'integer',
        'ubicacion_destino_id' => 'integer',
        'producto_id' => 'integer',
        'producto_precio_id' => 'integer',
        'factor_aplicado' => 'float',
        'cantidad' => 'integer',
        'cantidad_base' => 'integer',
        'referencia_id' => 'integer',
        'creado_por' => 'integer',
        'creado_en' => 'datetime',
    ];

    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id', 'id');
    }

    public function productoPrecio()
    {
        return $this->belongsTo(ProductoPrecio::class, 'producto_precio_id', 'id');
    }

    public function ubicacionOrigen()
    {
        return $this->belongsTo(Ubicacion::class, 'ubicacion_origen_id', 'id');
    }

    public function ubicacionDestino()
    {
        return $this->belongsTo(Ubicacion::class, 'ubicacion_destino_id', 'id');
    }

    public function creadoPor()
    {
        return $this->belongsTo(Usuario::class, 'creado_por', 'id');
    }
}