<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\AuditLog
 */
class AuditLogResource extends JsonResource
{
    /** Coarse family used only to pick the badge tone in the UI. */
    private const GROUPS = [
        'auth' => 'auth',
        'create' => 'created',
        'generate' => 'created',
        'update' => 'updated',
        'payment' => 'updated',
        'activate' => 'updated',
        'deactivate' => 'deleted',
        'delete' => 'deleted',
        'cancel' => 'deleted',
        'transfer' => 'stock',
        'adjust' => 'stock',
        'in' => 'stock',
        'out' => 'stock',
    ];

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'action' => $this->action,
            'action_group' => $this->actionGroup(),
            'subject_type' => $this->entity_type,
            'subject_label' => $this->entity_id !== null ? "#{$this->entity_id}" : null,
            'description' => $this->description,
            'ip_address' => $this->ip_address,
            'user' => $this->whenLoaded('user', fn () => $this->user === null ? null : [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'role' => $this->user->role?->name,
            ]),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    private function actionGroup(): string
    {
        [$domain, $verb] = array_pad(explode('.', (string) $this->action, 2), 2, '');

        return self::GROUPS[$verb] ?? (self::GROUPS[$domain] ?? 'updated');
    }
}
