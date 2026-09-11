<?php

namespace App\Services;

use App\Models\Role;
use App\Models\User;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Notification as NotificationFacade;

/**
 * Resolves "everyone who should hear about this" to a role list, then hands
 * off to Laravel's own notification system — {@see \App\Models\User} already
 * carries the `Notifiable` trait, this just saves every call site from
 * re-deriving the same "active users holding one of these roles" query.
 */
class NotificationDispatcher
{
    /** @param  list<string>  $roleSlugs */
    public function notifyRoles(array $roleSlugs, Notification $notification): void
    {
        $users = User::query()
            ->where('is_active', true)
            ->whereIn('role_id', Role::whereIn('slug', $roleSlugs)->pluck('id'))
            ->get();

        if ($users->isEmpty()) {
            return;
        }

        NotificationFacade::send($users, $notification);
    }
}
