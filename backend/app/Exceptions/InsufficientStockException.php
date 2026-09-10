<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Raised when a stock-out, sale or negative adjustment would drive on-hand
 * quantity below zero. Surfaces as HTTP 409 — it is a conflict with the
 * current state of the row, not a malformed request.
 */
class InsufficientStockException extends RuntimeException
{
    public function __construct(
        public readonly string $partLabel,
        public readonly int $available,
        public readonly int $requested,
    ) {
        parent::__construct(sprintf(
            'Insufficient stock for %s. %d unit(s) on hand, %d requested.',
            $partLabel,
            $available,
            $requested,
        ));
    }
}
