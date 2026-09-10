<?php

namespace App\Http\Requests\Stock;

use Illuminate\Foundation\Http\FormRequest;

/** Shared shape for both stock in and stock out. */
class StockMoveRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'part_id' => ['required', 'integer', 'exists:parts,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'warehouse_id' => ['nullable', 'integer', 'exists:warehouses,id'],
            'location_id' => ['nullable', 'integer', 'exists:locations,id'],
            'reference_no' => ['nullable', 'string', 'max:60'],
            'note' => ['nullable', 'string', 'max:500'],
        ];
    }
}
