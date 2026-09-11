<?php

namespace App\Http\Requests\Security;

use Illuminate\Foundation\Http\FormRequest;

class YardOrderSearchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** A scanned or typed number arrives with stray whitespace and any case. */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('order_no'))) {
            $this->merge(['order_no' => strtoupper(trim($this->input('order_no')))]);
        }
    }

    public function rules(): array
    {
        return [
            'order_no' => ['required', 'string', 'max:24', 'regex:/^[A-Z0-9-]+$/'],
        ];
    }

    public function messages(): array
    {
        return [
            'order_no.required' => 'Enter or scan an order number.',
            'order_no.max' => 'That is not a valid order number.',
            'order_no.regex' => 'That is not a valid order number.',
        ];
    }
}
