<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Vendedor extends Model
{
    protected $table = 'vendedores';

    const CREATED_AT = 'creado_en';
    const UPDATED_AT = 'actualizado_en';

    protected $fillable = [
        'usuario_id',
        'codigo',
    ];

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario_id');
    }

    public function rutas(): BelongsToMany
    {
        return $this->belongsToMany(Ruta::class, 'vendedor_rutas', 'vendedor_id', 'ruta_id');  
    }

    public function clientes(): BelongsToMany
    {
        return $this->belongsToMany(Cliente::class, 'vendedor_clientes', 'vendedor_id', 'cliente_id');
    }
}
