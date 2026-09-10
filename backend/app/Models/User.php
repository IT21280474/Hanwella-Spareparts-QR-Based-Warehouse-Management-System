<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role_id',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    /** @var list<string>|null Request-scoped permission cache. */
    private ?array $permissionCache = null;

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    /**
     * @return list<string>
     */
    public function permissions(): array
    {
        if ($this->permissionCache !== null) {
            return $this->permissionCache;
        }

        if ($this->role_id === null) {
            return $this->permissionCache = [];
        }

        return $this->permissionCache = $this->role
            ?->permissions()
            ->pluck('slug')
            ->all() ?? [];
    }

    public function hasPermission(string $slug): bool
    {
        return in_array($slug, $this->permissions(), true);
    }

    public function hasRole(string $slug): bool
    {
        return $this->role?->slug === $slug;
    }

    public function isAdmin(): bool
    {
        return $this->hasRole(Role::ADMIN);
    }

    public function initials(): string
    {
        preg_match_all('/\b\p{L}/u', $this->name, $m);

        return mb_strtoupper(implode('', array_slice($m[0] ?? [], 0, 2)));
    }
}
