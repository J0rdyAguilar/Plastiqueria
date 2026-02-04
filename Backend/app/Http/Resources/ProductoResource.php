public function toArray($request)
{
    return [
        'id' => $this->id,
        'sku' => $this->sku,
        'nombre' => $this->nombre,
        'descripcion' => $this->descripcion,
        'unidad_base' => $this->unidad_base,
        'alerta_stock' => $this->alerta_stock,
        'activo' => (bool) $this->activo,

        'imagen_principal' => $this->whenLoaded('imagenPrincipal', function () {
            return $this->imagenPrincipal ? [
                'id' => $this->imagenPrincipal->id,
                'url' => $this->imagenPrincipal->url,
            ] : null;
        }),
    ];
}
