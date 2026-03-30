<?php

namespace App\Models;

use App\Models\Usuario;
use App\Models\Ruta;
use App\Models\Zona;
use App\Models\Ubicacion;
use Illuminate\Database\Eloquent\Model;

class Venta extends Model
{
    protected $table = 'ventas';

    const CREATED_AT = 'creado_en';
    const UPDATED_AT = 'actualizado_en';

    protected $fillable = [
        'pedido_id',
        'caja_id',
        'ubicacion_id',
        'usuario_id',
        'vendedor_id',
        'cliente_id',
        'rutero_id',
        'ruta_id',
        'zona_id',
        'tipo_venta',
        'total',
        'efectivo',
        'cambio',
        'metodo_pago',
        'estado',
        'nota',
        'observaciones',
        'fecha_en_ruta',
        'entregado_en',
    ];

    protected $casts = [
        'total' => 'float',
        'efectivo' => 'float',
        'cambio' => 'float',
        'fecha_en_ruta' => 'datetime',
        'entregado_en' => 'datetime',
        'creado_en' => 'datetime',
        'actualizado_en' => 'datetime',
    ];

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    public function vendedor()
    {
        return $this->belongsTo(Vendedor::class, 'vendedor_id');
    }

    public function rutero()
    {
        return $this->belongsTo(Usuario::class, 'rutero_id');
    }
    
    public function ruta()
    {
        return $this->belongsTo(Ruta::class, 'ruta_id');
    }

    public function zona()
    {
        return $this->belongsTo(Zona::class, 'zona_id');
    }

    public function ubicacion()
    {
        return $this->belongsTo(Ubicacion::class, 'ubicacion_id');
    }

    public function detalles()
    {
        return $this->hasMany(VentaDetalle::class, 'venta_id');
    }
}