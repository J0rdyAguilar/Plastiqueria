<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Cliente extends Model
{
    protected $table = 'clientes';

    const CREATED_AT = 'creado_en';
    const UPDATED_AT = 'actualizado_en';

    protected $fillable = [
        'nombre',
        'propietario',
        'telefono',
        'zona_id',
        'ruta_id',
        'direccion',
        'referencia',
        'lat',
        'lng',
        'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
        'lat' => 'float',
        'lng' => 'float',
        'creado_en' => 'datetime',
        'actualizado_en' => 'datetime',
    ];

    public function zona(): BelongsTo
    {
        return $this->belongsTo(Zona::class, 'zona_id');
    }

    public function ruta(): BelongsTo
    {
        return $this->belongsTo(Ruta::class, 'ruta_id');
    }

    public function vendedores(): BelongsToMany
    {
        return $this->belongsToMany(Vendedor::class, 'vendedor_clientes', 'cliente_id', 'vendedor_id')
            ->withPivot(['id', 'asignado_en', 'activo']);
    }
}