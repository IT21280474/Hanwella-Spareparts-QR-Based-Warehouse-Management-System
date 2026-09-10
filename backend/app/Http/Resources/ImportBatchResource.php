<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\ImportBatch
 */
class ImportBatchResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'filename' => $this->filename,
            'status' => $this->status,
            'total_rows' => $this->total_rows,
            'valid_rows' => $this->valid_rows,
            'created_count' => $this->created_count,
            'updated_count' => $this->updated_count,
            'duplicate_count' => $this->duplicate_count,
            'rejected_count' => $this->rejected_count,
            'preview' => collect($this->preview ?? [])->map(fn (array $row) => [
                'row' => $row['row'],
                'part_number' => $row['part_number'],
                'name' => $row['name'],
                'quantity' => $row['quantity'],
                'price' => $row['selling_price'],
                'outcome' => $row['outcome'],
                'tone' => $row['tone'],
            ])->all(),
            'errors' => $this->errors ?? [],
        ];
    }
}
