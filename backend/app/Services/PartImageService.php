<?php

namespace App\Services;

use App\Models\Part;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * Stores and retires part photos.
 *
 * The one rule every caller must go through this for: several parts can
 * point at the same `image_path` (bulk photo import matches by filename,
 * and unmatched parts share a category placeholder), so a file is only
 * ever deleted from disk once nothing else still references it.
 */
class PartImageService
{
    private const DISK = 'public';

    public function store(UploadedFile $file): string
    {
        return $file->store('parts', self::DISK);
    }

    public function storeBytes(string $bytes, string $extension): string
    {
        $path = 'parts/'.bin2hex(random_bytes(16)).'.'.$extension;
        Storage::disk(self::DISK)->put($path, $bytes);

        return $path;
    }

    /**
     * Deletes $path from disk unless some other part still points at it.
     * $exceptPartId is the part being changed — its own (about-to-be-replaced)
     * row must not count as "still referencing" the old path.
     */
    public function deleteIfUnshared(?string $path, int $exceptPartId): void
    {
        if ($path === null) {
            return;
        }

        $stillReferenced = Part::where('image_path', $path)->where('id', '!=', $exceptPartId)->exists();

        if (! $stillReferenced) {
            Storage::disk(self::DISK)->delete($path);
        }
    }
}
