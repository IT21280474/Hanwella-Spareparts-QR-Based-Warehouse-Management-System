<?php

namespace App\Http\Requests\Users;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $user = $this->route('user');
        $isCreate = $this->isMethod('post');

        return [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:160', Rule::unique('users', 'email')->ignore($user)],
            'role' => ['required', 'string', Rule::exists('roles', 'slug')],
            'password' => [$isCreate ? 'required' : 'sometimes', 'nullable', 'string', 'min:8', 'max:72'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'An account with that email already exists.',
            'role.exists' => 'Choose a valid role.',
        ];
    }
}
