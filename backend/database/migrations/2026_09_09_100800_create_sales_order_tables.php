<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales_orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_no', 24)->unique();

            $table->string('customer_name', 160)->default('Walk-in customer');
            $table->string('customer_phone', 40)->nullable();

            $table->decimal('subtotal', 12, 2);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('total', 12, 2);
            $table->decimal('paid_amount', 12, 2)->default(0);

            $table->enum('payment_status', ['PAID', 'PENDING', 'PARTIALLY_PAID', 'CANCELLED'])->index();
            $table->enum('payment_mode', ['CASH', 'CARD', 'BANK_TRANSFER', 'CREDIT'])->default('CASH');
            $table->enum('status', ['COMPLETED', 'CANCELLED'])->default('COMPLETED');

            $table->foreignId('cashier_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('ordered_at')->useCurrent();
            $table->timestamps();

            $table->index(['ordered_at', 'payment_status']);
            $table->index('customer_name');
        });

        Schema::create('sales_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sales_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('part_id')->nullable()->constrained()->nullOnDelete();

            // Snapshots. A bill printed today must still read the same after the
            // part is renamed, repriced or deleted — so the line carries its own
            // copy rather than joining live catalogue data.
            $table->string('qr_code', 20)->nullable();
            $table->string('part_number', 60);
            $table->string('part_name', 200);
            $table->decimal('unit_price', 12, 2);

            $table->unsignedInteger('quantity');
            $table->decimal('line_total', 12, 2);

            $table->timestamps();

            $table->index('part_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_order_items');
        Schema::dropIfExists('sales_orders');
    }
};
