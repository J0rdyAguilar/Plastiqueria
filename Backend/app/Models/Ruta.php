<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Ruta extends Model
{
    protected $table = 'rutas';

    // ✅ Tus timestamps son personalizados
    const CREATED_AT = 'creado_en';
    const UPDATED_AT = 'actualizado_en';

    protected $fillable = [
        'zona_id',
        'nombre',
    ];

    protected $casts = [
        'zona_id' => 'integer',
    ];

    // ✅ Ruta pertenece a una Zona
    public function zona(): BelongsTo
    {
        return $this->belongsTo(Zona::class, 'zona_id');
    }

    // ✅ Relación con vendedores (pivot vendedor_rutas)
    public function vendedores(): BelongsToMany
    {
        return $this->belongsToMany(Vendedor::class, 'vendedor_rutas', 'ruta_id', 'vendedor_id')
            ->withTimestamps();
    }
}
