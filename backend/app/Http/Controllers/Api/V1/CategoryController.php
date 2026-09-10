<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\CategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) $request->integer('per_page', config('wms.per_page')), config('wms.max_per_page'));

        $categories = Category::query()
            ->withCount('parts')
            ->when($request->filled('search'), fn ($q) => $q->where(function ($q) use ($request) {
                $like = '%'.$request->string('search').'%';
                $q->where('name', 'like', $like)->orWhere('code', 'like', $like);
            }))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->orderBy('name')
            ->paginate($perPage);

        return ApiResponse::paginated(CategoryResource::collection($categories), 'Categories retrieved successfully.');
    }

    public function store(CategoryRequest $request): JsonResponse
    {
        $category = Category::create($request->validated());
        $this->audit->log('category.create', $category, [], $category->getAttributes(), "Category {$category->name} created");

        return ApiResponse::created(new CategoryResource($category), 'Category created successfully.');
    }

    public function show(Category $category): JsonResponse
    {
        return ApiResponse::success(new CategoryResource($category->loadCount('parts')), 'Category retrieved successfully.');
    }

    public function update(CategoryRequest $request, Category $category): JsonResponse
    {
        $before = $category->getAttributes();
        $category->update($request->validated());
        $this->audit->log('category.update', $category, $before, $category->getAttributes(), "Category {$category->name} updated");

        return ApiResponse::success(new CategoryResource($category), 'Category updated successfully.');
    }

    public function destroy(Category $category): JsonResponse
    {
        if ($category->parts()->exists()) {
            return ApiResponse::error(
                'This category has spare parts assigned to it. Reassign or remove them first.',
                409,
            );
        }

        $category->delete();
        $this->audit->log('category.delete', $category, $category->getAttributes(), [], "Category {$category->name} deleted");

        return ApiResponse::deleted('Category deleted successfully.');
    }
}
