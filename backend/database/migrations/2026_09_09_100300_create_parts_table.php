<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('parts', function (Blueprint $table) {
            $table->id();
            $table->string('part_number', 60)->unique();
            $table->string('sku', 60)->unique();
            $table->string('name', 200);
            $table->text('description')->nullable();

            $table->foreignId('category_id')->constrained()->restrictOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('vehicle_model_id')->nullable()->constrained()->nullOnDelete();

            $table->string('unit', 20)->default('pcs');
            $table->decimal('selling_price', 12, 2);
            $table->decimal('cost_price', 12, 2)->default(0);
            $table->unsignedInteger('min_stock')->default(8);

            $table->enum('status', ['ACTIVE', 'ARCHIVED'])->default('ACTIVE');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();

            $table->index('name');
            $table->index(['status', 'category_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('parts');
    }
};
