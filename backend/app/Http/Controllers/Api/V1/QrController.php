<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Stock\QrScanRequest;
use App\Http\Resources\PartResource;
use App\Http\Resources\QrScanResource;
use App\Models\Part;
use App\Models\QrCode;
use App\Models\QrScan;
use App\Services\AuditLogger;
use App\Services\QrService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class QrController extends Controller
{
    private const RECENT_SCANS_LIMIT = 20;

    public function __construct(
        private readonly QrService $qr,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * Backfill identities for parts that do not yet hold one. Given a
     * `part_id`, generates for that part only; given none, sweeps every part
     * missing an identity — the maintenance action for a catalogue imported
     * before QR issuance existed.
     */
    public function generate(Request $request): JsonResponse
    {
        $request->validate(['part_id' => ['sometimes', 'integer', 'exists:parts,id']]);

        $parts = $request->filled('part_id')
            ? Part::where('id', $request->integer('part_id'))->get()
            : Part::doesntHave('qrCode')->limit(500)->get();

        $issued = $parts->map(fn (Part $part) => $this->qr->generateFor($part))->values();

        return ApiResponse::success(
            $issued->map(fn (QrCode $qr) => ['code' => $qr->code, 'part_id' => $qr->part_id])->all(),
            $issued->isEmpty() ? 'Every part already holds a QR identity.' : "Issued {$issued->count()} QR identity(ies).",
        );
    }

    /**
     * Resolve a scanned or manually entered code to its part. The code is
     * never trusted as anything more than a lookup key.
     *
     * Every attempt — found or not — is recorded twice: a `QrScan` row (the
     * fast read path for the Scanner page's "recent scans" panel) and one
     * audit-log entry, since a scan is a real action a person took, not just
     * an internal lookup.
     */
    public function scan(QrScanRequest $request): JsonResponse
    {
        $code = $request->validated()['code'];
        $part = $this->qr->resolve($code);

        QrScan::create([
            'code' => $code,
            'part_id' => $part?->id,
            'user_id' => Auth::id(),
            'found' => $part !== null,
        ]);

        if ($part === null) {
            $this->audit->log('qr.scan', null, [], [], "Scanned {$code} — no matching part.");

            return ApiResponse::error('No spare part is linked to that code.', 404);
        }

        $part->load(['category:id,name', 'supplier:id,name', 'qrCode']);
        $part->setAttribute('total_stock', (int) $part->inventory()->sum('quantity'));

        $this->audit->log('qr.scan', $part, [], [], "Scanned {$code} · {$part->name}");

        return ApiResponse::success(new PartResource($part), 'Part resolved successfully.');
    }

    /** The Scanner page's own recent activity — every attempt, found or not. */
    public function recentScans(): JsonResponse
    {
        $scans = QrScan::query()
            ->with(['part:id,name,part_number', 'user:id,name'])
            ->orderByDesc('created_at')
            ->limit(self::RECENT_SCANS_LIMIT)
            ->get();

        return ApiResponse::success(QrScanResource::collection($scans)->resolve(), 'Recent scans retrieved successfully.');
    }

    public function show(string $code): JsonResponse
    {
        $part = $this->qr->resolve($code);

        if ($part === null) {
            return ApiResponse::error('No spare part is linked to that code.', 404);
        }

        $part->load(['category:id,name', 'supplier:id,name', 'qrCode']);
        $part->setAttribute('total_stock', (int) $part->inventory()->sum('quantity'));

        return ApiResponse::success(new PartResource($part), 'Part resolved successfully.');
    }

    /**
     * Label payloads for a print run: every sequence number in the requested
     * range, whether or not a part currently claims it — an unclaimed
     * identity is still a valid, printable label.
     */
    public function labels(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['required', 'integer', 'min:1'],
            'count' => ['required', 'integer', 'min:1', 'max:'.config('wms.qr.max_batch')],
        ]);

        $from = $request->integer('from');
        $count = $request->integer('count');
        $to = $from + $count - 1;

        $existing = QrCode::query()
            ->with(['part:id,name,part_number'])
            ->whereBetween('sequence', [$from, $to])
            ->get()
            ->keyBy('sequence');

        $labels = [];
        for ($sequence = $from; $sequence <= $to; $sequence++) {
            $qr = $existing->get($sequence);
            $bin = null;

            if ($qr?->part !== null) {
                $bin = $qr->part->inventory()
                    ->with('location:id,full_path')
                    ->whereNotNull('location_id')
                    ->orderByDesc('quantity')
                    ->first()?->location?->full_path;
            }

            $labels[] = [
                'code' => $qr?->code ?? $this->qr->format($sequence),
                'sequence' => $sequence,
                'assigned' => $qr !== null,
                'part_name' => $qr?->part?->name,
                'part_number' => $qr?->part?->part_number,
                'bin' => $bin,
            ];
        }

        return ApiResponse::success($labels, 'Labels retrieved successfully.', [
            'from' => $from,
            'to' => $to,
            'count' => $count,
        ]);
    }

    public function markPrinted(Request $request): JsonResponse
    {
        $request->validate([
            'codes' => ['required', 'array', 'min:1'],
            'codes.*' => ['string'],
        ]);

        $updated = $this->qr->markPrinted($request->input('codes'));

        return ApiResponse::success(null, "{$updated} label(s) marked as printed.");
    }
}
