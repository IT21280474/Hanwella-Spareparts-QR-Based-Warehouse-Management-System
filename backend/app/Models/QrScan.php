<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row per scan attempt from the Scanner page — found or not. Distinct
 * from `AuditLog` (which also gets one 'qr.scan' entry per attempt): this
 * table is the fast, purpose-built read path for the "recent scans" panel,
 * so that list never has to filter the whole audit trail by action name.
 */
class QrScan extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['code', 'part_id', 'user_id', 'found'];

    protected function casts(): array
    {
        return [
            'found' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    public function part(): BelongsTo
    {
        return $this->belongsTo(Part::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
