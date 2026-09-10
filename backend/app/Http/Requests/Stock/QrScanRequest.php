<?php

namespace App\Http\Requests\Stock;

use Illuminate\Foundation\Http\FormRequest;

class QrScanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Loosely shaped only — the database is the real authority on
            // whether a code exists. A camera or a keyboard can send anything.
            'code' => ['required', 'string', 'max:40'],
        ];
    }
}
