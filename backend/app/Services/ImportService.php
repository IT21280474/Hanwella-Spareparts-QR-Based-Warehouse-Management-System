<?php

namespace App\Services;

use App\Models\Category;
use App\Models\ImportBatch;
use App\Models\Part;
use App\Models\Supplier;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Bulk catalogue upload.
 *
 * `store()` never writes to `parts` — it parses the file once to build a
 * preview and an error report, and saves the file itself so `confirm()` can
 * re-parse and apply it later. Nothing about the catalogue changes until a
 * human has seen the preview and explicitly confirmed it.
 */
class ImportService
{
    /** Columns the template and every upload are read against, in order. */
    private const COLUMNS = ['part_number', 'name', 'category', 'supplier', 'unit', 'selling_price', 'cost_price', 'min_stock', 'quantity'];

    private const PREVIEW_LIMIT = 200;
    private const DISK = 'local';

    public function __construct(
        private readonly StockService $stock,
        private readonly QrService $qr,
        private readonly AuditLogger $audit,
    ) {}

    public function templateCsv(): string
    {
        $handle = fopen('php://temp', 'r+');
        fputcsv($handle, self::COLUMNS);
        fputcsv($handle, ['BRK-TOY-9001', 'Front Brake Pad Set - Toyota Corolla', 'Brake System', 'Lanka Auto Imports (Pvt) Ltd', 'pcs', '4200', '2900', '8', '20']);
        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        return $csv;
    }

    public function upload(UploadedFile $file): ImportBatch
    {
        $storedPath = $file->storeAs('imports', uniqid('import_', true).'.csv', self::DISK);

        $batch = ImportBatch::create([
            'user_id' => Auth::id(),
            'filename' => $file->getClientOriginalName(),
            'stored_path' => $storedPath,
            'status' => 'UPLOADED',
        ]);

        [$rows, $errors, $counts] = $this->parseAndValidate($storedPath);

        $batch->update([
            'total_rows' => $counts['total'],
            'valid_rows' => $counts['valid'],
            'created_count' => $counts['new'],
            'updated_count' => $counts['update'],
            'duplicate_count' => $counts['duplicate'],
            'rejected_count' => $counts['rejected'],
            'status' => 'VALIDATED',
            'preview' => array_slice($rows, 0, self::PREVIEW_LIMIT),
            'errors' => $errors,
        ]);

        return $batch;
    }

    public function confirm(ImportBatch $batch): ImportBatch
    {
        if ($batch->status === 'IMPORTED') {
            throw new RuntimeException('This import has already been applied.');
        }

        [$rows] = $this->parseAndValidate($batch->stored_path);

        $created = 0;
        $updated = 0;

        DB::transaction(function () use ($rows, &$created, &$updated) {
            $categories = Category::pluck('id', 'name');
            $suppliers = Supplier::pluck('id', 'name');

            foreach ($rows as $row) {
                if ($row['tone'] === 'error' || $row['tone'] === 'duplicate') {
                    continue;
                }

                $existing = Part::withTrashed()->where('part_number', $row['part_number'])->first();
                $categoryId = $categories[$row['category']] ?? null;

                if ($existing !== null) {
                    $existing->fill([
                        'name' => $row['name'],
                        'category_id' => $categoryId ?? $existing->category_id,
                        'supplier_id' => $suppliers[$row['supplier']] ?? $existing->supplier_id,
                        'unit' => $row['unit'] ?: $existing->unit,
                        'selling_price' => $row['selling_price'],
                        'cost_price' => $row['cost_price'] ?: $existing->cost_price,
                        'min_stock' => $row['min_stock'] ?: $existing->min_stock,
                    ])->save();

                    if ($row['quantity'] > 0) {
                        $this->stock->stockIn($existing, (int) $row['quantity'], null, null, 'IMPORT', 'Bulk Excel import');
                    }

                    $updated++;

                    continue;
                }

                $part = Part::create([
                    'part_number' => $row['part_number'],
                    'sku' => $row['part_number'],
                    'name' => $row['name'],
                    'category_id' => $categoryId,
                    'supplier_id' => $suppliers[$row['supplier']] ?? null,
                    'unit' => $row['unit'] ?: config('wms.inventory.default_unit'),
                    'selling_price' => $row['selling_price'],
                    'cost_price' => $row['cost_price'] ?: 0,
                    'min_stock' => $row['min_stock'] ?: config('wms.inventory.default_min_stock'),
                    'status' => Part::ACTIVE,
                    'created_by' => Auth::id(),
                ]);

                $this->qr->generateFor($part);

                if ($row['quantity'] > 0) {
                    $this->stock->stockIn($part, (int) $row['quantity'], null, null, 'IMPORT', 'Bulk Excel import — opening stock');
                }

                $created++;
            }
        });

        $batch->update(['status' => 'IMPORTED', 'created_count' => $created, 'updated_count' => $updated]);

        $this->audit->log('import.confirm', $batch, [], $batch->getAttributes(),
            "Import {$batch->filename} applied: {$created} created, {$updated} updated");

        return $batch;
    }

    public function errorReportCsv(ImportBatch $batch): string
    {
        [$rows] = $this->parseAndValidate($batch->stored_path);

        $handle = fopen('php://temp', 'r+');
        fputcsv($handle, ['row', ...self::COLUMNS, 'error']);

        foreach ($rows as $row) {
            if ($row['tone'] !== 'error') {
                continue;
            }
            fputcsv($handle, [$row['row'], $row['part_number'], $row['name'], $row['category'] ?? '', $row['supplier'] ?? '',
                $row['unit'] ?? '', $row['selling_price'] ?? '', $row['cost_price'] ?? '', $row['min_stock'] ?? '',
                $row['quantity'] ?? '', $row['error_message'] ?? '']);
        }

        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        return $csv;
    }

    /**
     * @return array{0: list<array<string, mixed>>, 1: list<array{rows: string, message: string}>, 2: array<string, int>}
     */
    private function parseAndValidate(string $storedPath): array
    {
        $handle = Storage::disk(self::DISK)->readStream($storedPath);
        if ($handle === false) {
            throw new RuntimeException('The uploaded file could not be read.');
        }

        $header = fgetcsv($handle);
        $header = $header !== false ? array_map(fn ($h) => strtolower(trim((string) $h)), $header) : [];

        $categories = Category::pluck('id', 'name');
        $suppliers = Supplier::pluck('id', 'name');
        $existingPartNumbers = Part::withTrashed()->pluck('id', 'part_number');

        $rows = [];
        $seenInFile = [];
        $counts = ['total' => 0, 'valid' => 0, 'new' => 0, 'update' => 0, 'duplicate' => 0, 'rejected' => 0];
        $rowNumber = 1;

        while (($raw = fgetcsv($handle)) !== false) {
            $rowNumber++;
            if (count(array_filter($raw, fn ($v) => trim((string) $v) !== '')) === 0) {
                continue; // blank line
            }

            $counts['total']++;
            $record = $this->mapRow($header, $raw);
            $record['row'] = $rowNumber;

            $error = $this->validateRow($record, $categories);

            if ($error !== null) {
                $record['tone'] = 'error';
                $record['error_message'] = $error;
                $record['outcome'] = 'Rejected';
                $counts['rejected']++;
            } elseif (isset($seenInFile[$record['part_number']])) {
                $record['tone'] = 'duplicate';
                $record['outcome'] = 'Duplicate in file';
                $counts['duplicate']++;
            } else {
                $seenInFile[$record['part_number']] = true;
                $isUpdate = isset($existingPartNumbers[$record['part_number']]);
                $record['tone'] = $isUpdate ? 'update' : 'new';
                $record['outcome'] = $isUpdate ? 'Update' : 'New';
                $counts[$isUpdate ? 'update' : 'new']++;
                $counts['valid']++;
            }

            $rows[] = $record;
        }

        fclose($handle);

        $errors = collect($rows)
            ->where('tone', 'error')
            ->groupBy('error_message')
            ->map(fn ($group, $message) => ['rows' => $group->pluck('row')->implode(', '), 'message' => $message])
            ->values()
            ->all();

        return [$rows, $errors, $counts];
    }

    private function mapRow(array $header, array $raw): array
    {
        $record = array_fill_keys(self::COLUMNS, null);

        foreach ($header as $index => $column) {
            if (in_array($column, self::COLUMNS, true) && array_key_exists($index, $raw)) {
                $record[$column] = trim((string) $raw[$index]);
            }
        }

        $record['selling_price'] = is_numeric($record['selling_price']) ? (float) $record['selling_price'] : $record['selling_price'];
        $record['cost_price'] = is_numeric($record['cost_price']) ? (float) $record['cost_price'] : 0;
        $record['min_stock'] = is_numeric($record['min_stock']) ? (int) $record['min_stock'] : 0;
        $record['quantity'] = is_numeric($record['quantity']) ? (int) $record['quantity'] : 0;

        return $record;
    }

    private function validateRow(array $record, $categories): ?string
    {
        if (($record['part_number'] ?? '') === '') {
            return 'Part number is required.';
        }

        if (($record['name'] ?? '') === '') {
            return 'Part name is required.';
        }

        if (! is_numeric($record['selling_price']) || (float) $record['selling_price'] <= 0) {
            return 'Selling price must be a positive number.';
        }

        if (($record['category'] ?? '') === '' || ! $categories->has($record['category'])) {
            return 'Category does not match any existing category name.';
        }

        return null;
    }
}
