<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('sales_orders', function (Blueprint $table) {
            // Null until stock actually leaves inventory for this order — now
            // gated on full payment rather than always happening at creation.
            // Tracked explicitly (not inferred from payment_status) so
            // cancel() knows, unambiguously, whether there is anything to
            // return: a still-PENDING order that never took stock must not
            // credit phantom units back when it is cancelled.
            $table->timestamp('stock_deducted_at')->nullable()->after('status');

            // Security's physical hand-over confirmation — independent of
            // the stock ledger, which already moved at payment time.
            $table->timestamp('dispatched_at')->nullable()->after('stock_deducted_at');
            $table->foreignId('dispatched_by')->nullable()->after('dispatched_at')
                ->constrained('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales_orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('dispatched_by');
            $table->dropColumn(['stock_deducted_at', 'dispatched_at']);
        });
    }
};
