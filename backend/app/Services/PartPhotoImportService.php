<?php

namespace App\Services;

use App\Models\Part;
use Illuminate\Http\UploadedFile;
use RuntimeException;
use ZipArchive;

/**
 * Bulk photo assignment: one .zip, one file per part, matched by filename.
 *
 * Deliberately not an ImportBatch-style preview-then-confirm flow — a wrong
 * photo is a one-file re-upload away from fixed, unlike a wrong price or
 * stock count, so there is nothing risky enough here to hold for review.
 */
class PartPhotoImportService
{
    public function __construct(private readonly PartImageService $images) {}

    /**
     * @return array{matched: int, unmatched: list<string>, rejected: list<array{file: string, reason: string}>}
     */
    public function import(UploadedFile $zipFile): array
    {
        $zip = new ZipArchive();
        if ($zip->open($zipFile->getRealPath()) !== true) {
            throw new RuntimeException('That file is not a valid .zip archive.');
        }

        $maxEntries = (int) config('wms.photo_import.max_entries');
        if ($zip->numFiles > $maxEntries) {
            $zip->close();
            throw new RuntimeException("This archive has {$zip->numFiles} files — the limit is {$maxEntries} per upload.");
        }

        $partsByNumber = Part::query()->pluck('id', 'part_number')
            ->merge(Part::query()->whereNotNull('sku')->pluck('id', 'sku'))
            ->mapWithKeys(fn ($id, $key) => [mb_strtolower($key) => $id]);

        $matched = 0;
        $unmatched = [];
        $rejected = [];
        $maxEntryBytes = (int) config('wms.photo_import.max_entry_kb') * 1024;

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);

            if ($this->isSkippable($name)) {
                continue;
            }

            $stat = $zip->statIndex($i);
            if ($stat !== false && $stat['size'] > $maxEntryBytes) {
                $rejected[] = ['file' => basename($name), 'reason' => 'File is larger than 8MB.'];
                continue;
            }

            $key = mb_strtolower(pathinfo($name, PATHINFO_FILENAME));
            $partId = $partsByNumber[$key] ?? null;

            if ($partId === null) {
                $unmatched[] = basename($name);
                continue;
            }

            $bytes = $zip->getFromIndex($i);
            $extension = $this->detectImageExtension($bytes);

            if ($extension === null) {
                $rejected[] = ['file' => basename($name), 'reason' => 'Not a readable JPEG, PNG or WebP image.'];
                continue;
            }

            /** @var Part $part */
            $part = Part::find($partId);
            $this->images->deleteIfUnshared($part->image_path, $part->id);

            $path = $this->images->storeBytes($bytes, $extension);
            $part->update(['image_path' => $path]);

            $matched++;
        }

        $zip->close();

        return ['matched' => $matched, 'unmatched' => $unmatched, 'rejected' => $rejected];
    }

    private function isSkippable(string $name): bool
    {
        if (str_ends_with($name, '/')) {
            return true; // directory entry
        }

        $basename = basename($name);

        return $basename === '' || str_starts_with($basename, '.') || str_starts_with($name, '__MACOSX/');
    }

    /** Validates real image content rather than trusting the filename's extension. */
    private function detectImageExtension(string|false $bytes): ?string
    {
        if ($bytes === false || $bytes === '') {
            return null;
        }

        $info = @getimagesizefromstring($bytes);
        if ($info === false) {
            return null;
        }

        return match ($info[2] ?? null) {
            IMAGETYPE_JPEG => 'jpg',
            IMAGETYPE_PNG => 'png',
            IMAGETYPE_WEBP => 'webp',
            default => null,
        };
    }
}
