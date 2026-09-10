<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\User
 */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'initials' => $this->initials(),
            'is_active' => $this->is_active,
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),

            'role' => $this->whenLoaded('role', fn () => [
                'slug' => $this->role->slug,
                'name' => $this->role->name,
            ]),

            // Drives which controls the UI renders. Never a security boundary —
            // every protected route is checked again server-side.
            'permissions' => $this->when(
                $this->relationLoaded('role'),
                fn () => $this->permissions(),
            ),
        ];
    }
}
