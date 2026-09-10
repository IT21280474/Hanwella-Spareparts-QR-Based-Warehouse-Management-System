<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImportBatch extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'filename', 'stored_path', 'total_rows', 'valid_rows',
        'created_count', 'updated_count', 'duplicate_count', 'rejected_count',
        'status', 'preview', 'errors',
    ];

    protected function casts(): array
    {
        return [
            'preview' => 'array',
            'errors' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
