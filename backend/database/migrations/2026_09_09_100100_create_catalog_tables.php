<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120)->unique();
            // The `BRK` in BRK-TOY-4821.
            $table->string('code', 3)->unique();
            $table->string('description', 255)->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 160)->unique();
            $table->string('contact_person', 120)->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('email', 160)->nullable();
            $table->string('address', 255)->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('vehicle_makes', function (Blueprint $table) {
            $table->id();
            $table->string('name', 80)->unique();
            // The `TOY` in BRK-TOY-4821.
            $table->string('code', 3)->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('vehicle_models', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_make_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->timestamps();

            $table->unique(['vehicle_make_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_models');
        Schema::dropIfExists('vehicle_makes');
        Schema::dropIfExists('suppliers');
        Schema::dropIfExists('categories');
    }
};
