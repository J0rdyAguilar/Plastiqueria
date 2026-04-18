<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Cuota extends Model
{
    protected $table = 'cuotas';

    const CREATED_AT = 'creado_en';
    const UPDATED_AT = 'actualizado_en';

    protected $fillable = [
        'ubicacion_id',
        'cliente_id',
        'caja_id',
        'origen_tipo',
        'origen_id',
        'rutero_id',
        'usuario_id',
        'total_credito',
        'total_abonado',
        'saldo_pendiente',
        'numero_cuotas',
        'cuotas_pagadas',
        'frecuencia_pago',
        'monto_por_cuota',
        'dia_pago',
        'estado',
        'fecha_inicio',
        'fecha_vencimiento',
        'proximo_vencimiento',
        'observaciones',
        'creado_por',
        'actualizado_por',
    ];

    protected $casts = [
        'ubicacion_id' => 'integer',
        'cliente_id' => 'integer',
        'caja_id' => 'integer',
        'origen_id' => 'integer',
        'rutero_id' => 'integer',
        'usuario_id' => 'integer',
        'creado_por' => 'integer',
        'actualizado_por' => 'integer',
        'numero_cuotas' => 'integer',
        'cuotas_pagadas' => 'integer',
        'dia_pago' => 'integer',
        'total_credito' => 'decimal:2',
        'total_abonado' => 'decimal:2',
        'saldo_pendiente' => 'decimal:2',
        'monto_por_cuota' => 'decimal:2',
        'fecha_inicio' => 'datetime',
        'fecha_vencimiento' => 'datetime',
        'proximo_vencimiento' => 'datetime',
        'creado_en' => 'datetime',
        'actualizado_en' => 'datetime',
    ];

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    public function ubicacion()
    {
        return $this->belongsTo(Ubicacion::class, 'ubicacion_id');
    }

    public function caja()
    {
        return $this->belongsTo(Caja::class, 'caja_id');
    }

    public function rutero()
    {
        return $this->belongsTo(Usuario::class, 'rutero_id');
    }

    public function usuario()
    {
        return $this->belongsTo(Usuario::class, 'usuario_id');
    }

    public function creador()
    {
        return $this->belongsTo(Usuario::class, 'creado_por');
    }

    public function actualizador()
    {
        return $this->belongsTo(Usuario::class, 'actualizado_por');
    }

    public function abonos()
    {
        return $this->hasMany(AbonoCuota::class, 'cuota_id');
    }

    public function ventaRutero()
    {
        return $this->belongsTo(Venta::class, 'origen_id')
            ->where('origen_tipo', 'venta_rutero');
    }

    public function ventaTienda()
    {
        return $this->belongsTo(VentaTienda::class, 'origen_id')
            ->where('origen_tipo', 'venta_tienda');
    }

    public function recalcularEstado()
    {
        $abonado = (float) $this->abonos()->sum('monto');
        $total = (float) $this->total_credito;
        $saldo = max($total - $abonado, 0);

        $estado = 'pendiente';

        if ($abonado > 0 && $saldo > 0) {
            $estado = 'parcial';
        }

        if ($saldo <= 0) {
            $estado = 'pagado';
        }

        $this->total_abonado = round($abonado, 2);
        $this->saldo_pendiente = round($saldo, 2);
        $this->estado = $estado;

        $montoPorCuota = (float) $this->monto_por_cuota;
        $cuotasPagadas = 0;

        if ($montoPorCuota > 0) {
            $cuotasPagadas = (int) floor($abonado / $montoPorCuota);
        }

        $this->cuotas_pagadas = min($cuotasPagadas, (int) $this->numero_cuotas);

        return $this;
    }
}