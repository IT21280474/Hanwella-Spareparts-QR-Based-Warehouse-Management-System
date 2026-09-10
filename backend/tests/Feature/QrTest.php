<?php

use App\Models\QrCode;
use App\Models\Role;
use App\Services\QrService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
    makeWarehouse();
});

it('issues sequential SJL identities in generation order', function () {
    $first = makePart();
    $second = makePart();

    $qr1 = app(QrService::class)->generateFor($first);
    $qr2 = app(QrService::class)->generateFor($second);

    expect($qr1->code)->toBe('SJL-00001');
    expect($qr2->code)->toBe('SJL-00002');
});

it('assigns a specific code and normalises lowercase input', function () {
    $part = makePart();

    $qr = app(QrService::class)->assignSpecific($part, 'sjl-00450');

    expect($qr->code)->toBe('SJL-00450');
    expect($qr->sequence)->toBe(450);
});

it('refuses to assign a specific code to a part that already has one', function () {
    $part = makePart();
    app(QrService::class)->generateFor($part);

    app(QrService::class)->assignSpecific($part->fresh(), 'SJL-00500');
})->throws(RuntimeException::class, 'This part already has a QR identity.');

it('refuses a specific code already taken by another part', function () {
    $taken = makePart();
    app(QrService::class)->assignSpecific($taken, 'SJL-00600');
    $other = makePart();

    app(QrService::class)->assignSpecific($other, 'SJL-00600');
})->throws(RuntimeException::class, 'QR code SJL-00600 is already assigned to another part.');

it('refuses a specific code that does not match the configured prefix and padding', function () {
    $part = makePart();

    app(QrService::class)->assignSpecific($part, 'ABC-123');
})->throws(RuntimeException::class);

it('never re-issues a second identity to a part that already holds one', function () {
    $part = makePart();
    $service = app(QrService::class);

    $first = $service->generateFor($part);
    $second = $service->generateFor($part->fresh());

    expect($second->id)->toBe($first->id);
    expect(QrCode::where('part_id', $part->id)->count())->toBe(1);
});

it('rejects a duplicate QR code at the database level', function () {
    $partA = makePart();
    $partB = makePart();

    QrCode::create(['code' => 'SJL-00001', 'sequence' => 1, 'part_id' => $partA->id, 'status' => QrCode::ACTIVE]);

    expect(fn () => QrCode::create(['code' => 'SJL-00001', 'sequence' => 2, 'part_id' => $partB->id, 'status' => QrCode::ACTIVE]))
        ->toThrow(QueryException::class);
});

it('rejects a duplicate QR sequence at the database level', function () {
    $partA = makePart();
    $partB = makePart();

    QrCode::create(['code' => 'SJL-00001', 'sequence' => 1, 'part_id' => $partA->id, 'status' => QrCode::ACTIVE]);

    expect(fn () => QrCode::create(['code' => 'SJL-00002', 'sequence' => 1, 'part_id' => $partB->id, 'status' => QrCode::ACTIVE]))
        ->toThrow(QueryException::class);
});

it('scans a valid QR code, returns the part and counts the scan', function () {
    $part = makePart();
    $qr = app(QrService::class)->generateFor($part);
    $staff = makeRoleUser(Role::WAREHOUSE_STAFF);

    $this->actingAs($staff)->postJson('/api/v1/qr/scan', ['code' => $qr->code])
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.id', $part->id)
        ->assertJsonPath('data.qr_code', $qr->code);

    $this->assertDatabaseHas('qr_codes', ['id' => $qr->id, 'scan_count' => 1]);
});

it('resolves a scan by part number when no QR identity has been issued yet', function () {
    $part = makePart(['part_number' => 'ABC-123', 'sku' => 'ABC-123-SKU']);
    $staff = makeRoleUser(Role::WAREHOUSE_STAFF);

    $this->actingAs($staff)->postJson('/api/v1/qr/scan', ['code' => 'abc-123-sku'])
        ->assertOk()
        ->assertJsonPath('data.id', $part->id);
});

it('returns a clean 404 for an unknown code instead of a server error', function () {
    $staff = makeRoleUser(Role::WAREHOUSE_STAFF);

    $this->actingAs($staff)->postJson('/api/v1/qr/scan', ['code' => 'SJL-99999'])
        ->assertStatus(404)
        ->assertJsonPath('success', false)
        ->assertJsonPath('message', 'No spare part is linked to that code.');
});

it('denies QR scanning to a role without scan_qr permission', function () {
    $viewer = makeRoleUser(Role::VIEWER);

    $this->actingAs($viewer)->postJson('/api/v1/qr/scan', ['code' => 'SJL-00001'])
        ->assertStatus(403);
});

it('allows a viewer to look up a code by view_inventory alone, without scan_qr', function () {
    $part = makePart();
    $qr = app(QrService::class)->generateFor($part);
    $viewer = makeRoleUser(Role::VIEWER);

    $this->actingAs($viewer)->getJson("/api/v1/qr/{$qr->code}")
        ->assertOk()
        ->assertJsonPath('data.id', $part->id);
});
