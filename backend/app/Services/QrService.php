<?php

namespace App\Services;

use App\Models\Part;
use App\Models\QrCode;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * QR identities are minted here and nowhere else.
 *
 * A code submitted by a client is only ever treated as a lookup key — it is
 * never trusted as an assertion that the identity exists or belongs to
 * anything. Generation is server-side, inside a transaction, and the unique
 * indexes on `code` and `sequence` are the real guarantee: if two requests
 * ever race to the same number, the database rejects one of them.
 */
class QrService
{
    public function __construct(
        private readonly AuditLogger $audit,
    ) {}

    private function prefix(): string
    {
        return (string) config('wms.qr.prefix');
    }

    private function pad(): int
    {
        return (int) config('wms.qr.pad');
    }

    public function format(int $sequence): string
    {
        return sprintf('%s-%s', $this->prefix(), str_pad((string) $sequence, $this->pad(), '0', STR_PAD_LEFT));
    }

    /** The identity the next generated part will receive. */
    public function peekNext(): string
    {
        return $this->format(((int) QrCode::max('sequence')) + 1);
    }

    /**
     * Assign a QR identity to a part that has none.
     *
     * Retries on a unique-constraint collision rather than pre-checking, which
     * is the only approach that is actually correct under concurrency: a
     * "SELECT max then INSERT" gap is exactly where duplicates get in.
     */
    public function generateFor(Part $part, int $attempts = 5): QrCode
    {
        if ($part->qrCode !== null) {
            return $part->qrCode;
        }

        for ($attempt = 1; $attempt <= $attempts; $attempt++) {
            try {
                return DB::transaction(function () use ($part) {
                    $sequence = ((int) QrCode::lockForUpdate()->max('sequence')) + 1;

                    $qr = QrCode::create([
                        'code' => $this->format($sequence),
                        'sequence' => $sequence,
                        'part_id' => $part->id,
                        'status' => QrCode::ACTIVE,
                        'generated_by' => Auth::id(),
                        'generated_at' => now(),
                    ]);

                    $this->audit->log('qr.generate', $part, [], ['code' => $qr->code],
                        sprintf('QR identity %s issued for %s', $qr->code, $part->part_number));

                    return $qr;
                });
            } catch (QueryException $e) {
                if (! $this->isUniqueViolation($e) || $attempt === $attempts) {
                    throw $e;
                }
                // Someone else took that number; go round again.
            }
        }

        throw new RuntimeException('Could not allocate a unique QR identity.');
    }

    /**
     * Assign a specific, already-known code instead of the next sequential
     * one — for a part whose physical bin already carries a pre-printed
     * label (e.g. from the original SJL-00001..SJL-01000 sheet) predating
     * its entry into this system. The code must still match this
     * installation's configured prefix/pad and be genuinely unused; format
     * and uniqueness are enforced here exactly as strictly as generateFor()
     * enforces uniqueness for an auto-assigned one.
     */
    public function assignSpecific(Part $part, string $rawCode): QrCode
    {
        if ($part->qrCode !== null) {
            throw new RuntimeException('This part already has a QR identity.');
        }

        $code = strtoupper(trim($rawCode));
        $pattern = sprintf('/^%s-(\d{%d})$/', preg_quote($this->prefix(), '/'), $this->pad());

        if (! preg_match($pattern, $code, $matches)) {
            throw new RuntimeException(sprintf('QR code must look like %s.', $this->format(1)));
        }

        $sequence = (int) $matches[1];

        try {
            return DB::transaction(function () use ($part, $code, $sequence) {
                $qr = QrCode::create([
                    'code' => $code,
                    'sequence' => $sequence,
                    'part_id' => $part->id,
                    'status' => QrCode::ACTIVE,
                    'generated_by' => Auth::id(),
                    'generated_at' => now(),
                ]);

                $this->audit->log('qr.assign_specific', $part, [], ['code' => $qr->code],
                    sprintf('QR identity %s manually assigned to %s', $qr->code, $part->part_number));

                return $qr;
            });
        } catch (QueryException $e) {
            if ($this->isUniqueViolation($e)) {
                throw new RuntimeException("QR code {$code} is already assigned to another part.");
            }

            throw $e;
        }
    }

    /**
     * Resolve a scanned code to its part.
     *
     * Accepts the QR identity, a part number or an SKU — the reference scanner
     * offers manual entry, and warehouse staff type whichever is printed in
     * front of them. Returns null when nothing matches; the caller decides
     * what an unknown code means.
     */
    public function resolve(string $rawCode): ?Part
    {
        $code = strtoupper(trim($rawCode));

        if ($code === '') {
            return null;
        }

        $qr = QrCode::with('part')->where('code', $code)->first();

        if ($qr?->part !== null) {
            $qr->forceFill([
                'scan_count' => $qr->scan_count + 1,
                'last_scanned_at' => now(),
            ])->save();

            return $qr->part;
        }

        return Part::query()
            ->where('part_number', $code)
            ->orWhere('sku', $code)
            ->first();
    }

    /**
     * Mark a range of identities as printed.
     *
     * @param  list<string>  $codes
     */
    public function markPrinted(array $codes): int
    {
        if ($codes === []) {
            return 0;
        }

        return QrCode::whereIn('code', $codes)->update([
            'print_count' => DB::raw('print_count + 1'),
            'last_printed_at' => now(),
        ]);
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        // MySQL 1062 / SQLSTATE 23000.
        return ($e->errorInfo[1] ?? null) === 1062 || $e->getCode() === '23000';
    }
}
