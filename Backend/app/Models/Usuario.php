<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Usuario extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $table = 'usuarios';

    // Timestamps personalizados
    const CREATED_AT = 'creado_en';
    const UPDATED_AT = 'actualizado_en';

    protected $fillable = [
        'nombre',
        'usuario',
        'telefono',
        'password',
        'rol',      // admin, vendedor, caja, etc (según tu ER)
        'activo',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'activo'   => 'boolean',
        // Laravel 10+ / 12 → hashea automáticamente al asignar
        'password' => 'hashed',
    ];

    /* =========================================================
       RELACIONES (según ER)
    ========================================================= */

    /**
     * Un usuario PUEDE ser un vendedor
     * usuarios.id -> vendedores.usuario_id
     */
    public function vendedor(): HasOne
    {
        return $this->hasOne(Vendedor::class, 'usuario_id');
    }

    /**
     * Si después manejás pedidos creados por usuario
     * usuarios.id -> pedidos.usuario_id
     */
    public function pedidos(): HasMany
    {
        return $this->hasMany(Pedido::class, 'usuario_id');
    }

    /* =========================================================
       SCOPES ÚTILES (para APIs)
    ========================================================= */

    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }

    public function scopeRol($query, string $rol)
    {
        return $query->where('rol', $rol);
    }
}
