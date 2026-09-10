<?php

namespace App\Http\Requests\Stock;

use Illuminate\Foundation\Http\FormRequest;

class TransferRequest extends FormRequest
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
            'from_location_id' => ['required', 'integer', 'exists:locations,id', 'different:to_location_id'],
            'to_location_id' => ['required', 'integer', 'exists:locations,id'],
            'reason' => ['nullable', 'string', 'max:255'],
        ];
    }
}
