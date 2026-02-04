<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ProductoUnidad extends Model
{
    use HasFactory;

    protected $table = 'producto_unidades';

    protected $fillable = [
        'producto_id',
        'unidad',            // enum tipo_unidad
        'etiqueta',          // "Unidad", "Docena", "Fardo"
        'factor_base',       // 1, 12, 24, etc
        'es_predeterminada', // bool
        'creado_en',
        'actualizado_en',
    ];

    protected $casts = [
        'factor_base'       => 'integer',
        'es_predeterminada' => 'boolean',
        'creado_en'         => 'datetime',
        'actualizado_en'    => 'datetime',
    ];

    public $timestamps = false;

    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id', 'id');
    }
}
