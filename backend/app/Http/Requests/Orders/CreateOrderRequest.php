<?php

namespace App\Http\Requests\Orders;

use App\Models\SalesOrder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'customer_name' => ['nullable', 'string', 'max:160'],
            'customer_phone' => ['nullable', 'string', 'max:40'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'payment_status' => ['required', Rule::in([SalesOrder::PAID, SalesOrder::PENDING, SalesOrder::PARTIALLY_PAID])],
            'payment_mode' => ['required', Rule::in(SalesOrder::PAYMENT_MODES)],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.part_id' => ['required', 'integer', 'exists:parts,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ];
    }

    public function messages(): array
    {
        return [
            'items.required' => 'Add at least one spare part to the order.',
            'items.min' => 'Add at least one spare part to the order.',
        ];
    }
}
