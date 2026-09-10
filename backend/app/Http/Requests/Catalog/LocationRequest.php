<?php

namespace App\Http\Requests\Catalog;

use App\Models\Location;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LocationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $location = $this->route('location');
        $warehouseId = $this->input('warehouse_id') ?? $location?->warehouse_id;

        return [
            'warehouse_id' => ['required', 'integer', 'exists:warehouses,id'],
            'parent_id' => [
                'nullable',
                'integer',
                Rule::exists('locations', 'id')->where('warehouse_id', $warehouseId),
                // A location cannot become its own ancestor.
                Rule::notIn(array_filter([$location?->id])),
            ],
            'type' => ['required', Rule::in([Location::ZONE, Location::RACK, Location::SHELF, Location::BIN])],
            'name' => ['required', 'string', 'max:80'],
            'code' => [
                'required', 'string', 'max:40',
                Rule::unique('locations', 'code')->where('warehouse_id', $warehouseId)->ignore($location),
            ],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /** A ZONE has no parent; everything else must sit under the correct parent level. */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $type = $this->input('type');
            $parentId = $this->input('parent_id');

            if ($type === Location::ZONE) {
                if ($parentId !== null) {
                    $validator->errors()->add('parent_id', 'A zone sits directly under the warehouse and cannot have a parent.');
                }

                return;
            }

            if ($parentId === null) {
                $validator->errors()->add('parent_id', 'Choose the parent location this sits inside.');

                return;
            }

            $parent = Location::find($parentId);
            $expectedParentType = array_flip(Location::CHILD_OF)[$type] ?? null;

            if ($parent !== null && $expectedParentType !== null && $parent->type !== $expectedParentType) {
                $validator->errors()->add(
                    'parent_id',
                    "A {$type} must sit inside a {$expectedParentType}.",
                );
            }
        });
    }
}
