<?php

namespace App\Http\Requests\Catalog;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Shared by store and update. On update the unique checks ignore the record
 * being edited via the route-bound category, so saving a category without
 * changing its name or code never trips its own uniqueness rule.
 */
class CategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $category = $this->route('category');

        return [
            'name' => ['required', 'string', 'max:120', Rule::unique('categories', 'name')->ignore($category)],
            'code' => ['required', 'string', 'size:3', 'alpha', Rule::unique('categories', 'code')->ignore($category)],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('code')) {
            $this->merge(['code' => strtoupper((string) $this->input('code'))]);
        }
    }
}
