/**
 * One error shape for the whole application.
 *
 * Every failure — network, HTTP, validation — reaches components as an
 * `ApiError`, so a component never has to know that Axios exists.
 */
export class ApiError extends Error {
  constructor({ message, status = 0, errors = {}, code = 'error' }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.code = code;
  }

  get isNetwork() {
    return this.code === 'network' || this.code === 'timeout';
  }

  get isUnauthenticated() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isConflict() {
    return this.status === 409;
  }

  get isValidation() {
    return this.status === 422;
  }

  get isThrottled() {
    return this.status === 429;
  }

  /** First message for a field, for inline form errors. */
  fieldError(field) {
    const value = this.errors?.[field];
    return Array.isArray(value) ? value[0] : value || '';
  }
}

const MESSAGE_BY_STATUS = {
  400: 'The request could not be processed.',
  401: 'Your session has ended. Please sign in again.',
  403: 'You do not have permission to do that.',
  404: 'The requested record could not be found.',
  409: 'That change conflicts with the current stock position. Reload and try again.',
  419: 'Your session expired. Please try again.',
  422: 'Please correct the highlighted fields.',
  429: 'Too many attempts. Wait a moment and try again.',
  500: 'An unexpected error occurred. Please try again.',
};

/** Translate any thrown value into an ApiError. */
export function toApiError(error) {
  if (error instanceof ApiError) return error;

  if (error?.code === 'ECONNABORTED') {
    return new ApiError({
      message: 'The server took too long to respond. Check your connection and try again.',
      code: 'timeout',
    });
  }

  if (!error?.response) {
    return new ApiError({
      message: 'Cannot reach the server. Check your connection and try again.',
      code: 'network',
    });
  }

  const { status, data } = error.response;

  return new ApiError({
    status,
    message: data?.message || MESSAGE_BY_STATUS[status] || 'Something went wrong.',
    errors: data?.errors || {},
    code: 'http',
  });
}

/** Human-readable summary, safe to show in a toast. */
export function errorMessage(error) {
  return toApiError(error).message;
}
