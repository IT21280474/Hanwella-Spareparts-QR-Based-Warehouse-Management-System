<?php

namespace App\Http\Requests\Catalog;

use App\Models\Part;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Shared by store and update. `quantity`, `warehouse_id` and `location_id`
 * are opening-stock placement and are only meaningful — and only
 * validated — on create; an edit never touches on-hand quantity.
 */
class PartRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $part = $this->route('part');
        $isCreate = $this->isMethod('post');

        return [
            'name' => ['required', 'string', 'max:200'],
            'part_number' => ['required', 'string', 'max:60', Rule::unique('parts', 'part_number')->ignore($part)],
            'sku' => ['nullable', 'string', 'max:60', Rule::unique('parts', 'sku')->ignore($part)],
            'description' => ['nullable', 'string', 'max:2000'],
            // Max 4MB, raster image types only. Rejected files never touch
            // disk — Laravel validates before the controller runs.
            'image' => ['nullable', 'image', 'mimes:jpeg,jpg,png,webp', 'max:4096'],
            // Lets the edit form clear a photo without uploading a replacement.
            'remove_image' => ['sometimes', 'boolean'],

            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'vehicle_model_id' => ['nullable', 'integer', 'exists:vehicle_models,id'],

            'unit' => ['nullable', 'string', 'max:20'],
            'selling_price' => ['required', 'numeric', 'min:0', 'max:9999999999.99'],
            'cost_price' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99'],
            'min_stock' => ['nullable', 'integer', 'min:0'],
            'status' => ['sometimes', Rule::in([Part::ACTIVE, Part::ARCHIVED])],

            'quantity' => [$isCreate ? 'required' : 'sometimes', 'integer', 'min:0'],
            'warehouse_id' => ['nullable', 'integer', 'exists:warehouses,id'],
            'location_id' => ['nullable', 'integer', 'exists:locations,id'],

            // Create-only: assign an already-known code (a pre-printed
            // physical label) instead of the next sequential one. Exact
            // format/uniqueness is enforced by QrService::assignSpecific(),
            // which knows the configured prefix/pad — kept in one place
            // rather than duplicating that pattern here.
            'qr_code' => [$isCreate ? 'nullable' : 'prohibited', 'string', 'max:20'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Give the part a recognisable name.',
            'part_number.required' => 'Part number is required.',
            'part_number.unique' => 'That part number is already in use.',
            'sku.unique' => 'That SKU is already in use.',
            'category_id.required' => 'Choose a category.',
            'selling_price.required' => 'Enter a selling price.',
            'quantity.required' => 'Enter the opening stock.',
            'image.image' => 'The photo must be an image file.',
            'image.mimes' => 'Photos must be JPEG, PNG or WebP.',
            'image.max' => 'Photos must be 4MB or smaller.',
        ];
    }
}
