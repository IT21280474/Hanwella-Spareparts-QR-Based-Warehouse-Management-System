<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Laravel's own notifications shape (see `Illuminate\Notifications\DatabaseNotification`
 * and the `Notifiable` trait already on {@see \App\Models\User}) — not a hand-rolled
 * table, so `$user->notifications`/`unreadNotifications` and `->markAsRead()` all work
 * with zero extra plumbing.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
