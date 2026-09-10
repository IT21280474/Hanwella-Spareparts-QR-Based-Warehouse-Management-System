<?php

use App\Models\Role;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
    makeWarehouse();
});

/** A single-file .zip built on the fly — real bytes, real archive, no fixtures on disk. */
function makeZip(array $entries): UploadedFile
{
    $path = tempnam(sys_get_temp_dir(), 'photoimport').'.zip';
    $zip = new ZipArchive();
    $zip->open($path, ZipArchive::CREATE);
    foreach ($entries as $name => $bytes) {
        $zip->addFromString($name, $bytes);
    }
    $zip->close();

    return new UploadedFile($path, 'photos.zip', 'application/zip', null, true);
}

it('matches a photo to a part by filename and assigns it', function () {
    Storage::fake('public');
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart(['part_number' => 'MATCH-001']);
    $jpeg = UploadedFile::fake()->image('x.jpg')->get();

    $zip = makeZip(['MATCH-001.jpg' => $jpeg]);

    $this->actingAs($admin)->post('/api/v1/imports/photos', ['file' => $zip])
        ->assertOk()
        ->assertJsonPath('data.matched', 1)
        ->assertJsonPath('data.unmatched', [])
        ->assertJsonPath('data.rejected', []);

    expect($part->fresh()->image_path)->not->toBeNull();
    Storage::disk('public')->assertExists($part->fresh()->image_path);
});

it('matches by sku when the filename does not match any part number', function () {
    Storage::fake('public');
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart(['part_number' => 'PN-999', 'sku' => 'SKU-999']);
    $jpeg = UploadedFile::fake()->image('x.jpg')->get();

    $zip = makeZip(['SKU-999.jpg' => $jpeg]);

    $this->actingAs($admin)->post('/api/v1/imports/photos', ['file' => $zip])
        ->assertOk()
        ->assertJsonPath('data.matched', 1);

    expect($part->fresh()->image_path)->not->toBeNull();
});

it('reports a file that matches no part as unmatched, without failing the batch', function () {
    Storage::fake('public');
    $admin = makeRoleUser(Role::ADMIN);
    $jpeg = UploadedFile::fake()->image('x.jpg')->get();

    $zip = makeZip(['NO-SUCH-PART.jpg' => $jpeg]);

    $this->actingAs($admin)->post('/api/v1/imports/photos', ['file' => $zip])
        ->assertOk()
        ->assertJsonPath('data.matched', 0)
        ->assertJsonPath('data.unmatched', ['NO-SUCH-PART.jpg']);
});

it('rejects a matched entry whose content is not really an image', function () {
    Storage::fake('public');
    $admin = makeRoleUser(Role::ADMIN);
    $part = makePart(['part_number' => 'BAD-CONTENT']);

    $zip = makeZip(['BAD-CONTENT.jpg' => 'this is not an image']);

    $response = $this->actingAs($admin)->post('/api/v1/imports/photos', ['file' => $zip])
        ->assertOk()
        ->assertJsonPath('data.matched', 0);

    expect($response->json('data.rejected.0.file'))->toBe('BAD-CONTENT.jpg');
    expect($part->fresh()->image_path)->toBeNull();
});

it('keeps a photo shared by other parts on disk when one of them gets its own', function () {
    Storage::fake('public');
    $admin = makeRoleUser(Role::ADMIN);
    $sharedPath = UploadedFile::fake()->image('shared.jpg')->store('parts', 'public');
    $target = makePart(['part_number' => 'SHARE-001', 'image_path' => $sharedPath]);
    $sibling = makePart(['image_path' => $sharedPath]);
    $jpeg = UploadedFile::fake()->image('x.jpg')->get();

    $zip = makeZip(['SHARE-001.jpg' => $jpeg]);

    $this->actingAs($admin)->post('/api/v1/imports/photos', ['file' => $zip])->assertOk();

    expect($target->fresh()->image_path)->not->toBe($sharedPath);
    expect($sibling->fresh()->image_path)->toBe($sharedPath);
    Storage::disk('public')->assertExists($sharedPath);
});

it('ignores directory entries and macOS zip metadata instead of reporting them as unmatched', function () {
    Storage::fake('public');
    $admin = makeRoleUser(Role::ADMIN);

    $path = tempnam(sys_get_temp_dir(), 'photoimport').'.zip';
    $zip = new ZipArchive();
    $zip->open($path, ZipArchive::CREATE);
    $zip->addEmptyDir('photos');
    $zip->addFromString('__MACOSX/._junk', 'junk');
    $zip->close();
    $upload = new UploadedFile($path, 'photos.zip', 'application/zip', null, true);

    $this->actingAs($admin)->post('/api/v1/imports/photos', ['file' => $upload])
        ->assertOk()
        ->assertJsonPath('data.matched', 0)
        ->assertJsonPath('data.unmatched', []);
});

it('rejects a non-zip file', function () {
    $admin = makeRoleUser(Role::ADMIN);

    $this->actingAs($admin)->post('/api/v1/imports/photos', [
        'file' => UploadedFile::fake()->create('not-a-zip.txt', 5, 'text/plain'),
    ])->assertStatus(422);
});

it('returns a clean 422 for a corrupt archive instead of a 500', function () {
    $admin = makeRoleUser(Role::ADMIN);

    // A truncated real zip — as a network interruption mid-upload would
    // produce. Whether Laravel's `mimes:zip` rule or ZipArchive::open()
    // itself is what actually catches this is an implementation detail;
    // what must hold is that a corrupt upload never reaches the generic
    // 500 handler (this is exactly the case a RuntimeException-to-422
    // mapping bug would silently break, in either layer).
    $realZip = makeZip(['a.txt' => str_repeat('x', 500)]);
    $truncated = substr(file_get_contents($realZip->getRealPath()), 0, 20);
    $path = tempnam(sys_get_temp_dir(), 'photoimport').'.zip';
    file_put_contents($path, $truncated);
    $corrupt = new UploadedFile($path, 'corrupt.zip', 'application/zip', null, true);

    $this->actingAs($admin)->post('/api/v1/imports/photos', ['file' => $corrupt])
        ->assertStatus(422)
        ->assertJsonPath('success', false);
});

it('denies bulk photo import to a viewer', function () {
    $viewer = makeRoleUser(Role::VIEWER);
    $jpeg = UploadedFile::fake()->image('x.jpg')->get();

    $this->actingAs($viewer)
        ->post('/api/v1/imports/photos', ['file' => makeZip(['ANY.jpg' => $jpeg])])
        ->assertStatus(403);
});
