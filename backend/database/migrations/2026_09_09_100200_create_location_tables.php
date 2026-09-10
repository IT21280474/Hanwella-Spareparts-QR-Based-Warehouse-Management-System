<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('warehouses', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('code', 12)->unique();
            $table->string('address', 255)->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        // Warehouse -> Zone -> Rack -> Shelf -> Bin as a single adjacency list.
        // One table keeps the hierarchy arbitrary-depth and lets a part sit at
        // any level, which five hard-coded tables would not.
        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('warehouse_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('locations')->cascadeOnDelete();
            $table->enum('type', ['ZONE', 'RACK', 'SHELF', 'BIN'])->index();
            $table->string('name', 80);
            $table->string('code', 40);
            // Denormalised "WH1 / Zone A / R3 / S2 / B7" for display and search
            // only — the parent_id chain remains the source of truth.
            $table->string('full_path', 255)->index();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['warehouse_id', 'code']);
            $table->index(['warehouse_id', 'parent_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('locations');
        Schema::dropIfExists('warehouses');
    }
};
