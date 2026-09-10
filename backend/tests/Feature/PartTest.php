<?php

use App\Models\Part;
use App\Models\Role;
use App\Services\StockService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
    makeWarehouse();
});

it('creates a part with opening stock and issues the first QR identity', function () {
    $admin = makeRoleUser(Role::ADMIN);
    $category = makeCategory();

    $this->actingAs($admin)->postJson('/api/v1/parts', [
        'name' => 'Front Brake Pad',
        'part_number' => 'BRK-TOY-4821',
        'category_id' => $category->id,
        'selling_price' => 3500,
        'cost_price' => 2000,
        'min_stock' => 10,
        'quantity' => 50,
    ])
        ->assertCreated()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.part_number', 'BRK-TOY-4821')
        ->assertJsonPath('data.quantity', 50)
        ->assertJsonPath('data.qr_code', 'SJL-00001');

    $this->assertDatabaseHas('qr_codes', ['code' => 'SJL-00001', 'sequence' => 1]);
    $this->assertDatabaseHas('stock_movements', [
        'type' => 'STOCK_IN', 'quantity' => 50, 'reference_no' => 'OPENING',
    ]);
    $this->assertDatabaseHas('audit_logs', ['action' => 'part.create']);
});

it('rejects a part with missing required fields', function () {
    $admin = makeRoleUser(Role::ADMIN);

    $this->actingAs($admin)->postJson('/api/v1/parts', [])
        ->assertStatus(422)
        ->assertJsonPath('success', false)
        ->assertJsonPath('message', 'Validation failed.')
        ->assertJsonStructure(['errors' => ['name', 'part_number', 'category_id', 'selling_price', 'quantity']]);
});

it('rejects a duplicate part number', function () {
    $admin = makeRoleUser(Role::ADMIN);
    $existing = makePart(['part_number' => 'BRK-DUP-001', 'sku' => 'BRK-DUP-001']);

    $this->actingAs($admin)->postJson('/api/v1/parts', [
        'name' => 'Another pad',
        'part_number' => 'BRK-DUP-001',
        'category_id' => $existing->category_id,
        'selling_price' => 100,
        'quantity' => 0,
    ])
        ->assertStatus(422)
        ->assertJsonPath('errors.part_number.0', 'That part number is already in use.');
});

it('finds a part by name, part number, sku or qr code', function () {
    $admin = makeRoleUser(Role::ADMIN);
    $target = makePart(['name' => 'Rear Shock Absorber', 'part_number' => 'SUS-777']);
    makePart(['name' => 'Cabin Air Filter', 'part_number' => 'FLT-111']);

    $this->actingAs($admin)->getJson('/api/v1/parts?search=SUS-777')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $target->id);
});

it('updates a part and writes an audit log entry', function () {
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart(['name' => 'Old Name']);

    $this->actingAs($admin)->putJson("/api/v1/parts/{$part->id}", [
        'name' => 'New Name',
        'part_number' => $part->part_number,
        'category_id' => $part->category_id,
        'selling_price' => $part->selling_price,
    ])
        ->assertOk()
        ->assertJsonPath('data.name', 'New Name');

    $this->assertDatabaseHas('parts', ['id' => $part->id, 'name' => 'New Name']);
    $this->assertDatabaseHas('audit_logs', ['action' => 'part.update']);
});

it('refuses to delete a part that still has stock on hand', function () {
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart();
    app(StockService::class)->stockIn($part, 10);

    $this->actingAs($admin)->deleteJson("/api/v1/parts/{$part->id}")
        ->assertStatus(409)
        ->assertJsonPath('success', false);

    $this->assertNotSoftDeleted('parts', ['id' => $part->id]);
});

it('deletes a part with zero stock on hand', function () {
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart();

    $this->actingAs($admin)->deleteJson("/api/v1/parts/{$part->id}")
        ->assertOk()
        ->assertJsonPath('success', true);

    $this->assertSoftDeleted('parts', ['id' => $part->id]);
});

it('denies part creation to a viewer', function () {
    $viewer = makeRoleUser(Role::VIEWER);

    $this->actingAs($viewer)->postJson('/api/v1/parts', [
        'name' => 'Anything', 'part_number' => 'X-1', 'category_id' => makeCategory()->id,
        'selling_price' => 100, 'quantity' => 0,
    ])->assertStatus(403);

    $this->assertDatabaseMissing('parts', ['part_number' => 'X-1']);
});

it('denies part deletion to warehouse staff even though they can update inventory', function () {
    $staff = makeRoleUser(Role::WAREHOUSE_STAFF);
    $part = makePart();

    $this->actingAs($staff)->deleteJson("/api/v1/parts/{$part->id}")
        ->assertStatus(403);

    $this->assertNotSoftDeleted('parts', ['id' => $part->id]);
});

it('assigns a specific QR code instead of the next sequential one when asked', function () {
    $admin = makeRoleUser(Role::ADMIN);

    $this->actingAs($admin)->postJson('/api/v1/parts', [
        'name' => 'Pre-labelled Part',
        'part_number' => 'PRE-001',
        'category_id' => makeCategory()->id,
        'selling_price' => 500,
        'quantity' => 0,
        'qr_code' => 'sjl-00777', // lowercase on input — service must normalise it
    ])
        ->assertCreated()
        ->assertJsonPath('data.qr_code', 'SJL-00777');

    $this->assertDatabaseHas('qr_codes', ['code' => 'SJL-00777', 'sequence' => 777]);
});

it('rejects a specific QR code already assigned to another part, and creates nothing', function () {
    $admin = makeRoleUser(Role::ADMIN);
    $existing = makePart();
    $takenCode = app(App\Services\QrService::class)->generateFor($existing)->code;

    $this->actingAs($admin)->postJson('/api/v1/parts', [
        'name' => 'Collides With Existing',
        'part_number' => 'PRE-002',
        'category_id' => makeCategory()->id,
        'selling_price' => 500,
        'quantity' => 0,
        'qr_code' => $takenCode,
    ])
        ->assertStatus(422)
        ->assertJsonPath('success', false);

    $this->assertDatabaseMissing('parts', ['part_number' => 'PRE-002']);
});

it('rejects a specific QR code that does not match the configured format', function () {
    $admin = makeRoleUser(Role::ADMIN);

    $this->actingAs($admin)->postJson('/api/v1/parts', [
        'name' => 'Bad Format',
        'part_number' => 'PRE-003',
        'category_id' => makeCategory()->id,
        'selling_price' => 500,
        'quantity' => 0,
        'qr_code' => 'NOT-A-REAL-CODE',
    ])
        ->assertStatus(422);

    $this->assertDatabaseMissing('parts', ['part_number' => 'PRE-003']);
});

it('never lets an update change or set the QR code', function () {
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart();

    $this->actingAs($admin)->putJson("/api/v1/parts/{$part->id}", [
        'name' => $part->name,
        'part_number' => $part->part_number,
        'category_id' => $part->category_id,
        'selling_price' => $part->selling_price,
        'qr_code' => 'SJL-00999',
    ])
        ->assertStatus(422)
        ->assertJsonStructure(['errors' => ['qr_code']]);
});

it('stores an uploaded photo and returns its public URL', function () {
    Storage::fake('public');
    $admin = makeRoleUser(Role::ADMIN);
    $category = makeCategory();

    $response = $this->actingAs($admin)->post('/api/v1/parts', [
        'name' => 'Headlight Assembly',
        'part_number' => 'LGT-001',
        'category_id' => $category->id,
        'selling_price' => 8000,
        'quantity' => 0,
        'image' => UploadedFile::fake()->image('headlight.jpg'),
    ])->assertCreated();

    $path = Part::where('part_number', 'LGT-001')->value('image_path');
    expect($path)->not->toBeNull();
    Storage::disk('public')->assertExists($path);
    expect($response->json('data.image_url'))->toContain($path);
});

it('rejects a non-image upload with a clean validation error', function () {
    Storage::fake('public');
    $admin = makeRoleUser(Role::ADMIN);

    $this->actingAs($admin)->post('/api/v1/parts', [
        'name' => 'Bad Upload',
        'part_number' => 'BAD-001',
        'category_id' => makeCategory()->id,
        'selling_price' => 100,
        'quantity' => 0,
        'image' => UploadedFile::fake()->create('not-a-photo.pdf', 10, 'application/pdf'),
    ])
        ->assertStatus(422)
        ->assertJsonPath('errors.image.0', 'The photo must be an image file.');

    $this->assertDatabaseMissing('parts', ['part_number' => 'BAD-001']);
});

it('replaces the photo on update and deletes the previous file', function () {
    Storage::fake('public');
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart(['image_path' => UploadedFile::fake()->image('old.jpg')->store('parts', 'public')]);
    $oldPath = $part->image_path;
    Storage::disk('public')->assertExists($oldPath);

    $this->actingAs($admin)->post("/api/v1/parts/{$part->id}", [
        '_method' => 'PUT',
        'name' => $part->name,
        'part_number' => $part->part_number,
        'category_id' => $part->category_id,
        'selling_price' => $part->selling_price,
        'image' => UploadedFile::fake()->image('new.jpg'),
    ])->assertOk();

    $newPath = $part->fresh()->image_path;
    expect($newPath)->not->toBeNull()->not->toBe($oldPath);
    Storage::disk('public')->assertExists($newPath);
    Storage::disk('public')->assertMissing($oldPath);
});

it('keeps a photo on disk when another part still shares it', function () {
    Storage::fake('public');
    $admin = makeRoleUser(Role::ADMIN);
    $sharedPath = UploadedFile::fake()->image('shared.jpg')->store('parts', 'public');
    $partA = makePart(['image_path' => $sharedPath]);
    $partB = makePart(['image_path' => $sharedPath]);

    $this->actingAs($admin)->post("/api/v1/parts/{$partA->id}", [
        '_method' => 'PUT',
        'name' => $partA->name,
        'part_number' => $partA->part_number,
        'category_id' => $partA->category_id,
        'selling_price' => $partA->selling_price,
        'image' => UploadedFile::fake()->image('new.jpg'),
    ])->assertOk();

    // partA moved on to its own photo, but partB's copy of the old path must
    // still resolve — the shared file was never actually deleted.
    Storage::disk('public')->assertExists($sharedPath);
    expect($partB->fresh()->image_path)->toBe($sharedPath);
});

it('clears the photo when remove_image is sent without a replacement', function () {
    Storage::fake('public');
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart(['image_path' => UploadedFile::fake()->image('old.jpg')->store('parts', 'public')]);
    $oldPath = $part->image_path;

    $this->actingAs($admin)->putJson("/api/v1/parts/{$part->id}", [
        'name' => $part->name,
        'part_number' => $part->part_number,
        'category_id' => $part->category_id,
        'selling_price' => $part->selling_price,
        'remove_image' => true,
    ])
        ->assertOk()
        ->assertJsonPath('data.image_url', null);

    expect($part->fresh()->image_path)->toBeNull();
    Storage::disk('public')->assertMissing($oldPath);
});
