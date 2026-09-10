<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

/**
 * Writes the audit trail.
 *
 * Called explicitly from services rather than bolted onto a model observer:
 * an observer records that a row changed, this records what a person was
 * trying to do. Intent is the part that matters when reading a trail back.
 */
class AuditLogger
{
    /**
     * Attributes that must never reach the audit table, whatever the caller
     * passes in. Matched case-insensitively against the key.
     */
    private const REDACTED = [
        'password',
        'password_confirmation',
        'current_password',
        'remember_token',
        'token',
        'api_token',
        'access_token',
        'secret',
    ];

    public function log(
        string $action,
        ?Model $entity = null,
        array $oldValues = [],
        array $newValues = [],
        ?string $description = null,
    ): AuditLog {
        return AuditLog::create([
            'user_id' => Auth::id(),
            'action' => $action,
            'entity_type' => $entity !== null ? class_basename($entity) : null,
            'entity_id' => $entity?->getKey(),
            'description' => $description,
            'old_values' => $this->scrub($oldValues) ?: null,
            'new_values' => $this->scrub($newValues) ?: null,
            'ip_address' => Request::ip(),
            'user_agent' => substr((string) Request::userAgent(), 0, 255),
        ]);
    }

    /**
     * Convenience for the common "record what changed on this model" case.
     */
    public function logChange(string $action, Model $entity, array $before, ?string $description = null): AuditLog
    {
        $after = $entity->getAttributes();

        // Only report keys that actually moved — a diff nobody has to read past.
        $changed = array_keys(array_filter(
            $after,
            fn ($value, $key) => ! array_key_exists($key, $before) || $before[$key] != $value,
            ARRAY_FILTER_USE_BOTH,
        ));

        return $this->log(
            $action,
            $entity,
            array_intersect_key($before, array_flip($changed)),
            array_intersect_key($after, array_flip($changed)),
            $description,
        );
    }

    private function scrub(array $values): array
    {
        foreach ($values as $key => $value) {
            foreach (self::REDACTED as $needle) {
                if (stripos((string) $key, $needle) !== false) {
                    unset($values[$key]);
                    continue 2;
                }
            }

            if (is_array($value)) {
                $values[$key] = $this->scrub($value);
            }
        }

        return $values;
    }
}
