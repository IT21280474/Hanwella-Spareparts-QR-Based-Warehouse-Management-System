<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

class ReportController extends Controller
{
    private const TYPES = [
        'sales', 'inventory', 'payments', 'low-stock',
        'out-of-stock', 'stock-in', 'stock-out', 'user-activity',
    ];

    public function __construct(private readonly ReportService $reports) {}

    public function show(Request $request, string $type): JsonResponse
    {
        $this->assertKnownType($type);

        $report = $this->reports->build(
            $type,
            $request->string('from')->toString() ?: null,
            $request->string('to')->toString() ?: null,
        );

        return ApiResponse::success($report, 'Report retrieved successfully.');
    }

    public function export(Request $request, string $type): Response
    {
        $this->assertKnownType($type);

        $report = $this->reports->build(
            $type,
            $request->string('from')->toString() ?: null,
            $request->string('to')->toString() ?: null,
        );

        $columns = $this->reports->columnsFor($type);

        $handle = fopen('php://temp', 'r+');
        fputcsv($handle, $columns);
        foreach ($report['rows'] as $row) {
            fputcsv($handle, array_map(fn ($column) => $row[$column] ?? '', $columns));
        }
        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$type}-report.csv\"",
        ]);
    }

    private function assertKnownType(string $type): void
    {
        if (! in_array($type, self::TYPES, true)) {
            throw ValidationException::withMessages(['type' => 'Unknown report type.']);
        }
    }
}
