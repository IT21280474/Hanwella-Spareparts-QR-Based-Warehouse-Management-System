<?php

namespace App\Http\Requests\Orders;

use App\Models\SalesOrder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOrderPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'payment_status' => ['required', Rule::in([SalesOrder::PAID, SalesOrder::PENDING, SalesOrder::PARTIALLY_PAID])],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
