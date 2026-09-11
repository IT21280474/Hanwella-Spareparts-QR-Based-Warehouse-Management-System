<?php

use App\Models\Category;
use App\Models\Location;
use App\Models\Part;
use App\Models\Role;
use App\Models\User;
use App\Models\Warehouse;
use Tests\TestCase;

uses(TestCase::class)->in('Feature');

/*
|--------------------------------------------------------------------------
| Shared feature fixtures
|--------------------------------------------------------------------------
|
| Named distinctly from AuthTest's own makeUser() so both can be loaded in
| the same PHPUnit process without a "cannot redeclare function" fatal —
| Pest includes every test file into one process, and PHP does not scope
| top-level function declarations to the file that defines them.
|
*/

function makeRoleUser(string $roleSlug = Role::ADMIN, array $attributes = []): User
{
    return User::create(array_merge([
        'name' => 'Test User',
        'email' => 'user-'.uniqid().'@hanwellaspares.lk',
        'password' => 'correct-horse-battery',
        'role_id' => Role::where('slug', $roleSlug)->value('id'),
        'is_active' => true,
    ], $attributes));
}

/** An active warehouse, required by StockService whenever a caller omits warehouse_id. */
function makeWarehouse(array $attributes = []): Warehouse
{
    // warehouses.code is varchar(12); keep the random suffix short enough to fit.
    return Warehouse::create(array_merge([
        'name' => 'Hanwella Main Store',
        'code' => 'HW-'.strtoupper(substr(uniqid(), -8)),
        'is_active' => true,
    ], $attributes));
}

function makeCategory(array $attributes = []): Category
{
    // categories.code is varchar(3); a base-36 counter always fits and stays
    // unique. `name` also carries a unique constraint, so it gets the same
    // counter appended.
    static $sequence = 0;
    $sequence++;

    return Category::create(array_merge([
        'name' => 'Brake System '.$sequence,
        'code' => strtoupper(base_convert((string) $sequence, 10, 36)),
        'is_active' => true,
    ], $attributes));
}

/** A leaf bin, to test that stock movements find a part's real location. */
function makeLocation(Warehouse $warehouse, array $attributes = []): Location
{
    $suffix = strtoupper(substr(uniqid(), -6));

    return Location::create(array_merge([
        'warehouse_id' => $warehouse->id,
        'type' => Location::BIN,
        'name' => 'Bin '.$suffix,
        'code' => 'B-'.$suffix,
        'full_path' => 'Bin '.$suffix,
        'is_active' => true,
    ], $attributes));
}

function makePart(array $attributes = []): Part
{
    $suffix = (string) random_int(100000, 999999);

    return Part::create(array_merge([
        'part_number' => 'TST-'.$suffix,
        'sku' => 'TST-'.$suffix,
        'name' => 'Test Brake Pad Set',
        'category_id' => makeCategory()->id,
        'selling_price' => 1500,
        'cost_price' => 900,
        'min_stock' => 5,
        'status' => Part::ACTIVE,
    ], $attributes));
}

/*
|--------------------------------------------------------------------------
| Stateful requests
|--------------------------------------------------------------------------
|
| The API authenticates SPA callers by session cookie. Sanctum only promotes a
| request to a stateful one when its Origin (or Referer) matches a configured
| stateful domain — so a test that omits the header exercises the token path
| instead, and any controller touching the session fails with "Session store
| not set on request".
|
| Sending the header here means the feature suite drives the same code path the
| browser does, rather than a path only tests ever take.
|
*/
uses()
    ->beforeEach(function () {
        config()->set('sanctum.stateful', ['localhost']);
        $this->withHeader('Origin', 'http://localhost');
    })
    ->in('Feature');
