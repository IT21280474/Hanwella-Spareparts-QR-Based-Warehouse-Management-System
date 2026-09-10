<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Illuminate\Pagination\AbstractPaginator;

/**
 * The single place the API response envelope is defined.
 *
 * Success: {success, message, data, meta?}
 * Failure: {success, message, errors?}
 */
final class ApiResponse
{
    public static function success(mixed $data = null, string $message = 'OK', array $meta = [], int $status = 200): JsonResponse
    {
        $payload = [
            'success' => true,
            'message' => $message,
            'data' => $data,
        ];

        if ($meta !== []) {
            $payload['meta'] = $meta;
        }

        return response()->json($payload, $status);
    }

    public static function created(mixed $data = null, string $message = 'Created successfully.'): JsonResponse
    {
        return self::success($data, $message, [], 201);
    }

    public static function deleted(string $message = 'Deleted successfully.'): JsonResponse
    {
        return self::success(null, $message);
    }

    public static function error(string $message, int $status = 400, array $errors = []): JsonResponse
    {
        $payload = [
            'success' => false,
            'message' => $message,
        ];

        if ($errors !== []) {
            $payload['errors'] = $errors;
        }

        return response()->json($payload, $status);
    }

    /**
     * Wrap a paginated result, lifting Laravel's pagination fields into `meta`
     * so `data` is always the plain row array the frontend expects.
     */
    public static function paginated(
        ResourceCollection|AbstractPaginator $paginator,
        string $message = 'OK',
        array $extraMeta = []
    ): JsonResponse {
        $resolved = $paginator instanceof ResourceCollection
            ? $paginator->resource
            : $paginator;

        $rows = $paginator instanceof ResourceCollection
            ? $paginator->collection
            : $resolved->getCollection();

        return self::success($rows, $message, array_merge([
            'current_page' => $resolved->currentPage(),
            'per_page' => (int) $resolved->perPage(),
            'total' => $resolved->total(),
            'last_page' => $resolved->lastPage(),
            'from' => $resolved->firstItem(),
            'to' => $resolved->lastItem(),
        ], $extraMeta));
    }
}
