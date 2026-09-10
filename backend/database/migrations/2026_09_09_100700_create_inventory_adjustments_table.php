<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A quantity is never silently overwritten. Every adjustment records
        // what it was, what changed, what it became, why, by whom and when.
        // Adjustment types are the reference's four, preserved verbatim.
        Schema::create('inventory_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('part_id')->constrained()->cascadeOnDelete();
            $table->foreignId('inventory_id')->nullable()->constrained('inventory')->nullOnDelete();

            $table->enum('adjustment_type', [
                'STOCK_RECEIVED',
                'MANUAL_ADJUSTMENT',
                'SALE_CORRECTION',
                'DAMAGE_WRITE_OFF',
            ])->index();

            $table->unsignedInteger('quantity_before');
            $table->integer('adjustment');
            $table->unsignedInteger('quantity_after');

            $table->string('reason', 255)->nullable();
            $table->text('note')->nullable();

            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['part_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_adjustments');
    }
};
