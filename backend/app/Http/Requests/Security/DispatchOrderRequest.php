<?php

namespace App\Http\Requests\Security;

use Illuminate\Foundation\Http\FormRequest;

/**
 * The whole dispatch payload is an optional note.
 *
 * Nothing about the order's payment, totals or status is accepted from the
 * client — only validated() is ever read, so a body carrying
 * `payment_status: "PAID"` has no effect at all. Eligibility is decided by
 * DispatchService against the database row.
 */
class DispatchOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'notes' => ['nullable', 'string', 'max:255'],
        ];
    }
}
