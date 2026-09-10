<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Stock is held per part + warehouse + location. A part's on-hand total
        // is SUM(quantity) across its rows; holding one number on `parts` would
        // make transfers inexpressible.
        Schema::create('inventory', function (Blueprint $table) {
            $table->id();
            $table->foreignId('part_id')->constrained()->cascadeOnDelete();
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->foreignId('location_id')->nullable()->constrained()->nullOnDelete();

            $table->unsignedInteger('quantity')->default(0);
            $table->unsignedInteger('reserved_quantity')->default(0);

            $table->timestamps();

            $table->unique(['part_id', 'warehouse_id', 'location_id'], 'inventory_part_wh_loc_unique');
            $table->index(['warehouse_id', 'location_id']);
            $table->index('quantity');
        });

        // Belt and braces behind the unsigned column and the service-layer
        // guard: no code path can ever leave a row negative or over-reserved.
        DB::statement('ALTER TABLE inventory ADD CONSTRAINT chk_inventory_quantity_non_negative CHECK (quantity >= 0)');
        DB::statement('ALTER TABLE inventory ADD CONSTRAINT chk_inventory_reserved_within_qty CHECK (reserved_quantity <= quantity)');
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory');
    }
};
