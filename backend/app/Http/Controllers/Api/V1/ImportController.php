<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ImportBatchResource;
use App\Models\ImportBatch;
use App\Services\ImportService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ImportController extends Controller
{
    public function __construct(private readonly ImportService $imports) {}

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            // Genuine .xlsx parsing is a follow-up (needs PhpSpreadsheet); a
            // CSV export of the same template is accepted today so the bulk
            // upload workflow is not blocked on that dependency.
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:10240'],
        ], [
            'file.mimes' => 'Save the spreadsheet as CSV (File → Save As → CSV) and upload that file.',
        ]);

        $batch = $this->imports->upload($request->file('file'));

        return ApiResponse::success(
            new ImportBatchResource($batch),
            "{$batch->valid_rows} of {$batch->total_rows} rows are ready to import.",
        );
    }

    public function show(ImportBatch $batch): JsonResponse
    {
        return ApiResponse::success(new ImportBatchResource($batch), 'Import batch retrieved successfully.');
    }

    public function confirm(ImportBatch $batch): JsonResponse
    {
        $batch = $this->imports->confirm($batch);

        return ApiResponse::success(
            new ImportBatchResource($batch),
            "{$batch->created_count} part(s) added, {$batch->updated_count} updated.",
        );
    }

    public function template(): Response
    {
        return response($this->imports->templateCsv(), 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="spare-parts-import-template.csv"',
        ]);
    }

    public function errors(ImportBatch $batch): Response
    {
        return response($this->imports->errorReportCsv($batch), 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"import-{$batch->id}-errors.csv\"",
        ]);
    }
}
