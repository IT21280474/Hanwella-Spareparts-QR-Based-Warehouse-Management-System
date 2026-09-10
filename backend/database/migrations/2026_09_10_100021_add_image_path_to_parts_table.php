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
        Schema::table('parts', function (Blueprint $table) {
            // Path on the 'public' disk, e.g. "parts/xyz123.jpg". Nullable —
            // most seed/import data has no photo. The full URL is built by
            // PartResource, never stored, so it stays correct if APP_URL changes.
            $table->string('image_path', 255)->nullable()->after('description');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('parts', function (Blueprint $table) {
            $table->dropColumn('image_path');
        });
    }
};
