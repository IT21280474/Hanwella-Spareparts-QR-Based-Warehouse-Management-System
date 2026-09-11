<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Yard stock and dispatch.
 *
 * An order enters the yard the moment it is fully paid and leaves it when
 * Security dispatches it at the gate. Neither state gets a status column of
 * its own: "in the yard" is derived from payment + `dispatched_at`, so there
 * is no second flag that could drift out of step with the money.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_orders', function (Blueprint $table) {
            // Maintained by SalesOrder itself: set when the order becomes
            // fully paid, cleared if it ever stops being so.
            $table->timestamp('paid_at')->nullable()->after('paid_amount');

            $table->timestamp('dispatched_at')->nullable()->after('ordered_at');
            $table->foreignId('dispatched_by')->nullable()->after('dispatched_at')->constrained('users')->nullOnDelete();

            // The yard-stock query: PAID, not yet dispatched, oldest paid first.
            $table->index(['payment_status', 'dispatched_at', 'paid_at'], 'sales_orders_yard_index');
        });

        // Orders already settled before this column existed entered the yard
        // at their last update — the closest record of when payment completed.
        DB::table('sales_orders')
            ->where('payment_status', 'PAID')
            ->whereNull('paid_at')
            ->update(['paid_at' => DB::raw('updated_at')]);

        Schema::create('dispatches', function (Blueprint $table) {
            $table->id();

            // Unique: the database itself refuses a second dispatch of the
            // same order, whatever the application layer does. Restricted
            // delete: a dispatched order is audit history and cannot vanish.
            $table->foreignId('sales_order_id')->unique()->constrained()->restrictOnDelete();

            // Snapshots of what physically left the gate, so the record reads
            // the same however the order or catalogue is later edited.
            $table->string('order_no', 24)->index();
            $table->string('customer_name', 160);
            $table->string('customer_phone', 40)->nullable();
            $table->unsignedInteger('items_count');
            $table->unsignedInteger('total_quantity');
            $table->decimal('total', 12, 2);
            $table->decimal('paid_amount', 12, 2);
            $table->string('payment_status_at_dispatch', 20);
            $table->json('items');

            $table->foreignId('dispatched_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('dispatched_by_name', 120);
            $table->timestamp('dispatched_at')->index();
            $table->string('notes', 255)->nullable();

            $table->timestamps();

            $table->index('customer_name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispatches');

        Schema::table('sales_orders', function (Blueprint $table) {
            $table->dropIndex('sales_orders_yard_index');
            $table->dropForeign(['dispatched_by']);
            $table->dropColumn(['paid_at', 'dispatched_at', 'dispatched_by']);
        });
    }
};
