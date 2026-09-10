<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One QR identity per spare-part TYPE, not per physical unit — the
        // reference states it outright: "one QR identity covers the full part
        // type across all warehouse bins".
        //
        // `code` and `sequence` both carry unique constraints. The database is
        // the authority on QR uniqueness; the generator merely proposes.
        Schema::create('qr_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();
            $table->unsignedInteger('sequence')->unique();
            $table->foreignId('part_id')->unique()->constrained()->cascadeOnDelete();

            $table->enum('status', ['ACTIVE', 'VOID'])->default('ACTIVE')->index();
            $table->foreignId('generated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('generated_at')->useCurrent();
            $table->timestamp('last_printed_at')->nullable();
            $table->unsignedInteger('print_count')->default(0);
            $table->unsignedInteger('scan_count')->default(0);
            $table->timestamp('last_scanned_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('qr_codes');
    }
};
