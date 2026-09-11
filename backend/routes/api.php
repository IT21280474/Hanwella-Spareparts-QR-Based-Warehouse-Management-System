<?php

use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\ImportController;
use App\Http\Controllers\Api\V1\InventoryController;
use App\Http\Controllers\Api\V1\LocationController;
use App\Http\Controllers\Api\V1\MovementController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\PartController;
use App\Http\Controllers\Api\V1\PartPhotoImportController;
use App\Http\Controllers\Api\V1\QrController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\SettingsController;
use App\Http\Controllers\Api\V1\StockController;
use App\Http\Controllers\Api\V1\SupplierController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\VehicleReferenceController;
use App\Http\Controllers\Api\V1\WarehouseController;
use App\Support\ApiResponse;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    /*
    |--------------------------------------------------------------------------
    | Public
    |--------------------------------------------------------------------------
    */

    Route::post('auth/login', [AuthController::class, 'login'])
        ->middleware(['guest', 'throttle:6,1'])
        ->name('auth.login');

    Route::post('auth/forgot-password', [AuthController::class, 'forgotPassword'])
        ->middleware(['guest', 'throttle:3,1'])
        ->name('auth.forgot-password');

    Route::post('auth/reset-password', [AuthController::class, 'resetPassword'])
        ->middleware(['guest', 'throttle:3,1'])
        ->name('auth.reset-password');

    // The import template is a static download; letting it sit behind auth
    // buys nothing and only complicates a curl/Postman smoke test.
    Route::get('imports/template', [ImportController::class, 'template'])->name('imports.template');

    /*
    |--------------------------------------------------------------------------
    | Authenticated
    |--------------------------------------------------------------------------
    */

    Route::middleware('auth:sanctum')->group(function () {

        Route::post('auth/logout', [AuthController::class, 'logout'])->name('auth.logout');
        Route::get('auth/me', [AuthController::class, 'me'])->name('auth.me');

        Route::get('dashboard', [DashboardController::class, 'index'])
            ->middleware('permission:view_dashboard');

        Route::get('dashboard/security', [DashboardController::class, 'security'])
            ->middleware('permission:dispatch_orders');

        // ---- Parts (catalogue CRUD) ----
        Route::middleware('permission:view_inventory')->group(function () {
            Route::get('parts', [PartController::class, 'index']);
            Route::get('parts/{part}', [PartController::class, 'show']);
            Route::get('parts/{part}/movements', [PartController::class, 'movements']);
        });
        Route::post('parts', [PartController::class, 'store'])->middleware('permission:create_inventory');
        Route::put('parts/{part}', [PartController::class, 'update'])->middleware('permission:update_inventory');
        Route::delete('parts/{part}', [PartController::class, 'destroy'])->middleware('permission:delete_inventory');

        // ---- Inventory (stock-aware listing) ----
        Route::middleware('permission:view_inventory')->group(function () {
            Route::get('inventory', [InventoryController::class, 'index']);
            Route::get('inventory/{part}', [InventoryController::class, 'show']);
        });
        Route::post('inventory/transfer', [InventoryController::class, 'transfer'])->middleware('permission:update_inventory');

        // ---- QR ----
        Route::post('qr/generate', [QrController::class, 'generate'])->middleware('permission:print_labels');
        Route::post('qr/scan', [QrController::class, 'scan'])->middleware('permission:scan_qr');
        Route::get('qr/labels', [QrController::class, 'labels'])->middleware('permission:print_labels');
        Route::post('qr/labels/printed', [QrController::class, 'markPrinted'])->middleware('permission:print_labels');
        Route::get('qr/{code}', [QrController::class, 'show'])->middleware('permission:view_inventory,scan_qr');

        // ---- Stock operations ----
        Route::post('stock/in', [StockController::class, 'stockIn'])->middleware('permission:create_stock_in');
        Route::post('stock/out', [StockController::class, 'stockOut'])->middleware('permission:create_stock_out');
        Route::post('stock/adjust', [StockController::class, 'adjust'])->middleware('permission:update_inventory');

        // ---- Movement ledger ----
        Route::get('movements', [MovementController::class, 'index'])->middleware('permission:view_transactions');

        // ---- Orders / POS ----
        Route::middleware('permission:view_transactions')->group(function () {
            Route::get('orders', [OrderController::class, 'index']);
            Route::get('orders/{order}', [OrderController::class, 'show']);
        });
        Route::post('orders', [OrderController::class, 'store'])->middleware('permission:create_stock_out');
        Route::patch('orders/{order}/payment', [OrderController::class, 'updatePayment'])->middleware('permission:create_stock_out');
        Route::post('orders/{order}/cancel', [OrderController::class, 'cancel'])->middleware('permission:create_stock_out');
        Route::post('orders/{order}/dispatch', [OrderController::class, 'dispatch'])->middleware('permission:dispatch_orders');

        // ---- Reference data ----
        Route::middleware('permission:view_inventory')->group(function () {
            Route::get('categories', [CategoryController::class, 'index']);
            Route::get('categories/{category}', [CategoryController::class, 'show']);
            Route::get('suppliers', [SupplierController::class, 'index']);
            Route::get('suppliers/{supplier}', [SupplierController::class, 'show']);
            Route::get('warehouses', [WarehouseController::class, 'index']);
            Route::get('warehouses/{warehouse}', [WarehouseController::class, 'show']);
            Route::get('locations', [LocationController::class, 'index']);
            Route::get('locations/{location}', [LocationController::class, 'show']);
            Route::get('vehicle-makes', [VehicleReferenceController::class, 'makes']);
            Route::get('vehicle-models', [VehicleReferenceController::class, 'models']);
        });
        Route::middleware('permission:manage_settings')->group(function () {
            Route::post('categories', [CategoryController::class, 'store']);
            Route::put('categories/{category}', [CategoryController::class, 'update']);
            Route::delete('categories/{category}', [CategoryController::class, 'destroy']);
            Route::post('suppliers', [SupplierController::class, 'store']);
            Route::put('suppliers/{supplier}', [SupplierController::class, 'update']);
            Route::delete('suppliers/{supplier}', [SupplierController::class, 'destroy']);
            Route::post('warehouses', [WarehouseController::class, 'store']);
            Route::put('warehouses/{warehouse}', [WarehouseController::class, 'update']);
            Route::delete('warehouses/{warehouse}', [WarehouseController::class, 'destroy']);
            Route::post('locations', [LocationController::class, 'store']);
            Route::put('locations/{location}', [LocationController::class, 'update']);
            Route::delete('locations/{location}', [LocationController::class, 'destroy']);
        });

        // ---- Users & roles ----
        Route::get('roles', [RoleController::class, 'index'])->middleware('permission:manage_users');
        Route::middleware('permission:manage_users')->group(function () {
            Route::get('users', [UserController::class, 'index']);
            Route::post('users', [UserController::class, 'store']);
            Route::get('users/{user}', [UserController::class, 'show']);
            Route::put('users/{user}', [UserController::class, 'update']);
            Route::patch('users/{user}/status', [UserController::class, 'setStatus']);
            Route::get('audit-logs', [AuditLogController::class, 'index']);
        });

        // ---- Bulk import ----
        Route::middleware('permission:create_inventory')->group(function () {
            Route::post('imports', [ImportController::class, 'store']);
            Route::get('imports/{batch}', [ImportController::class, 'show']);
            Route::post('imports/{batch}/confirm', [ImportController::class, 'confirm']);
            Route::get('imports/{batch}/errors', [ImportController::class, 'errors']);
            Route::post('imports/photos', [PartPhotoImportController::class, 'store']);
        });

        // ---- Reports ----
        Route::get('reports/{type}', [ReportController::class, 'show'])->middleware('permission:view_reports');
        Route::get('reports/{type}/export', [ReportController::class, 'export'])->middleware('permission:export_reports');

        // ---- Settings ----
        Route::get('settings', [SettingsController::class, 'show'])->middleware('permission:manage_settings');
        Route::put('settings', [SettingsController::class, 'update'])->middleware('permission:manage_settings');
    });
});

Route::fallback(fn () => ApiResponse::error('The requested endpoint does not exist.', 404));
