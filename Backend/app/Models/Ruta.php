<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Ruta extends Model
{
    protected $table = 'rutas';

    const CREATED_AT = 'creado_en';
    const UPDATED_AT = 'actualizado_en';

    protected $fillable = [
        'zona_id',
        'nombre',
    ];

    protected $casts = [
        'zona_id' => 'integer',
    ];

    public function zona(): BelongsTo
    {
        return $this->belongsTo(Zona::class, 'zona_id');
    }

    public function vendedores(): BelongsToMany
    {
        return $this->belongsToMany(Vendedor::class, 'vendedor_rutas', 'ruta_id', 'vendedor_id')
            ->withTimestamps();
    }

    public function clientes(): HasMany
    {
        return $this->hasMany(Cliente::class, 'ruta_id');
    }
}