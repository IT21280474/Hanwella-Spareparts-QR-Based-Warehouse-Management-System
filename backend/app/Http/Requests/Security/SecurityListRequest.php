<?php

namespace App\Http\Requests\Security;

use Illuminate\Foundation\Http\FormRequest;

/** Search, date range and paging for the yard-stock and dispatch-history tables. */
class SecurityListRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.config('wms.max_per_page')],
        ];
    }

    public function perPage(): int
    {
        return (int) ($this->validated('per_page') ?? config('wms.per_page'));
    }
}
