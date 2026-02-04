<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreProductoImagenRequest;
use App\Http\Requests\UpdateProductoImagenRequest;
use App\Models\ProductoImagen;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProductoImagenController extends Controller
{
    public function index(Request $request)
    {
        $productoId = $request->query('producto_id');

        $q = ProductoImagen::query()
            ->when($productoId, fn($qq) => $qq->where('producto_id', $productoId))
            ->orderByDesc('es_principal')
            ->orderBy('orden')
            ->orderBy('id');

        return $q->paginate(30);
    }

    /**
     * Subir imagen
     * form-data: producto_id, imagen(file), es_principal(optional), orden(optional)
     */
    public function store(StoreProductoImagenRequest $request)
    {
        $data = $request->validated();
        $productoId = (int) $data['producto_id'];

        $file = $request->file('imagen');
        $ext = strtolower($file->getClientOriginalExtension() ?: 'jpg');

        $filename = now()->format('YmdHis') . '_' . Str::random(8) . '.' . $ext;
        $path = "productos/{$productoId}/{$filename}";

        return DB::transaction(function () use ($productoId, $file, $path, $data) {

            Storage::disk('public')->put($path, file_get_contents($file->getRealPath()));

            $url = "storage/{$path}";

            $esPrincipal = (bool)($data['es_principal'] ?? false);
            $orden = isset($data['orden']) ? (int)$data['orden'] : 0;

            if ($esPrincipal) {
                ProductoImagen::where('producto_id', $productoId)->update(['es_principal' => 0]);
            } else {
                $hasPrincipal = ProductoImagen::where('producto_id', $productoId)->where('es_principal', 1)->exists();
                if (!$hasPrincipal) $esPrincipal = true;
            }

            $row = ProductoImagen::create([
                'producto_id'  => $productoId,
                'url'          => $url,
                'es_principal' => $esPrincipal,
                'orden'        => $orden,
                'creado_en'    => now(),
            ]);

            return response()->json($row, 201);
        });
    }

    public function show(ProductoImagen $productoImagen)
    {
        return $productoImagen;
    }

    public function update(UpdateProductoImagenRequest $request, ProductoImagen $productoImagen)
    {
        $data = $request->validated();

        return DB::transaction(function () use ($data, $productoImagen) {

            if (array_key_exists('es_principal', $data) && (bool)$data['es_principal'] === true) {
                ProductoImagen::where('producto_id', $productoImagen->producto_id)
                    ->where('id', '!=', $productoImagen->id)
                    ->update(['es_principal' => 0]);
            }

            $productoImagen->update($data);

            return response()->json($productoImagen);
        });
    }

    public function destroy(ProductoImagen $productoImagen)
    {
        return DB::transaction(function () use ($productoImagen) {

            $url = (string)$productoImagen->url;
            if (str_starts_with($url, 'storage/')) {
                $relative = substr($url, strlen('storage/'));
                Storage::disk('public')->delete($relative);
            }

            $productoId = $productoImagen->producto_id;
            $wasPrincipal = (bool)$productoImagen->es_principal;

            $productoImagen->delete();

            if ($wasPrincipal) {
                $next = ProductoImagen::where('producto_id', $productoId)
                    ->orderBy('orden')
                    ->orderBy('id')
                    ->first();

                if ($next) $next->update(['es_principal' => 1]);
            }

            return response()->json(['message' => 'Imagen eliminada']);
        });
    }
}
