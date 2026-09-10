<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use App\Services\PartPhotoImportService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Bulk-assigns part photos from a single .zip, matched by filename.
 *
 * Kept separate from {@see ImportController}: that one runs a tracked,
 * two-step preview-then-confirm flow because a bad row can misprice or
 * misstock a part. A photo carries none of that risk, so this is a plain
 * one-shot upload with an immediate summary.
 */
class PartPhotoImportController extends Controller
{
    public function __construct(
        private readonly PartPhotoImportService $photos,
        private readonly AuditLogger $audit,
    ) {}

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'file' => [
                'required',
                'file',
                'mimes:zip',
                'max:'.(int) config('wms.photo_import.max_zip_kb'),
            ],
        ], [
            'file.mimes' => 'Upload a single .zip file containing the photos.',
        ]);

        $result = $this->photos->import($request->file('file'));

        $this->audit->log(
            'part.bulk_photo_import',
            null,
            [],
            ['matched' => $result['matched'], 'unmatched' => count($result['unmatched']), 'rejected' => count($result['rejected'])],
            "Bulk photo import: {$result['matched']} part(s) matched, ".count($result['unmatched']).' unmatched.',
        );

        $message = $result['matched'] === 1
            ? '1 photo assigned.'
            : "{$result['matched']} photos assigned.";

        if (count($result['unmatched']) > 0 || count($result['rejected']) > 0) {
            $message .= ' '.count($result['unmatched']).' file(s) had no matching part, '.count($result['rejected']).' rejected.';
        }

        return ApiResponse::success($result, $message);
    }
}
