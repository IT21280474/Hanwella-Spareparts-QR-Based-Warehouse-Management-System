<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QrCode extends Model
{
    use HasFactory;

    public const ACTIVE = 'ACTIVE';
    public const VOID = 'VOID';

    protected $fillable = [
        'code', 'sequence', 'part_id', 'status', 'generated_by', 'generated_at',
        'last_printed_at', 'print_count', 'scan_count', 'last_scanned_at',
    ];

    protected function casts(): array
    {
        return [
            'generated_at' => 'datetime',
            'last_printed_at' => 'datetime',
            'last_scanned_at' => 'datetime',
            'sequence' => 'integer',
            'print_count' => 'integer',
            'scan_count' => 'integer',
        ];
    }

    public function part(): BelongsTo
    {
        return $this->belongsTo(Part::class);
    }

    public function generatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by');
    }
}
