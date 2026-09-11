<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LoginRequest extends FormRequest
{
    public const PORTAL_SECURITY = 'security';

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:160'],
            'password' => ['required', 'string', 'max:200'],
            'remember' => ['sometimes', 'boolean'],
            // Which sign-in screen the request came from. `security` admits
            // only accounts that can work the yard gate.
            'portal' => ['sometimes', 'nullable', Rule::in([self::PORTAL_SECURITY])],
        ];
    }

    public function messages(): array
    {
        return [
            'email.required' => 'Enter your email address.',
            'password.required' => 'Enter your password.',
        ];
    }
}
