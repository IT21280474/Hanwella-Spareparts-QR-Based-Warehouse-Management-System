<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    use HasFactory;

    public const ADMIN = 'ADMIN';
    public const MANAGER = 'MANAGER';
    public const WAREHOUSE_STAFF = 'WAREHOUSE_STAFF';
    public const SALES_PERSON = 'SALES_PERSON';
    public const SECURITY = 'SECURITY';
    public const VIEWER = 'VIEWER';

    protected $fillable = ['slug', 'name', 'description'];

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
