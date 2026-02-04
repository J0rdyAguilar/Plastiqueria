<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ProductoImagen extends Model
{
    use HasFactory;

    protected $table = 'producto_imagenes';

    protected $fillable = [
        'producto_id',
        'url',
        'es_principal',
        'orden',
        'creado_en',
    ];

    protected $casts = [
        'producto_id'   => 'integer',
        'es_principal'  => 'boolean',
        'orden'         => 'integer',
        'creado_en'     => 'datetime',
    ];

    // Tu tabla NO usa created_at / updated_at
    public $timestamps = false;

    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id', 'id');
    }
}
