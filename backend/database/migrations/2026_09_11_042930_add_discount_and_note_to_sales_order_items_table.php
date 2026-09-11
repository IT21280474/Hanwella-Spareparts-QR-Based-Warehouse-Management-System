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
        Schema::table('sales_order_items', function (Blueprint $table) {
            // Same semantic as sales_orders.discount: a Rupee amount off this
            // line's (unit_price * quantity), not a price override — unit_price
            // stays the true catalogue price at sale time either way, so
            // margin/reporting queries never have to guess whether it already
            // reflects a discount.
            $table->decimal('discount', 12, 2)->default(0)->after('unit_price');
            $table->string('note', 200)->nullable()->after('line_total');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->dropColumn(['discount', 'note']);
        });
    }
};
