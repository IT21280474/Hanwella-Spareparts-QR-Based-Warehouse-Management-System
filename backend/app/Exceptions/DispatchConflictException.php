<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Raised when an order's current state does not allow what was asked of it
 * at the yard gate: dispatching an unpaid, cancelled or already-dispatched
 * order, or changing an order after its goods have left. Surfaces as HTTP
 * 409 — a conflict with the row as it stands, not a malformed request.
 */
class DispatchConflictException extends RuntimeException
{
}
