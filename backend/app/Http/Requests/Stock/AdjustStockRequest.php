<?php

namespace App\Http\Requests\Stock;

use App\Models\InventoryAdjustment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdjustStockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'part_id' => ['required', 'integer', 'exists:parts,id'],
            'adjustment_type' => ['required', Rule::in([
                InventoryAdjustment::STOCK_RECEIVED,
                InventoryAdjustment::MANUAL_ADJUSTMENT,
                InventoryAdjustment::SALE_CORRECTION,
                InventoryAdjustment::DAMAGE_WRITE_OFF,
            ])],
            'quantity' => ['required', 'integer', 'min:1'],
            'note' => ['nullable', 'string', 'max:500'],
        ];
    }
}
