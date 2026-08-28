/**
 * Standard application error. Any thrown AppError is translated to a JSON
 * response by the global error handler middleware.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'AppError';
  }
}

export const errors = {
  badRequest: (message: string, details?: unknown) =>
    new AppError(400, 'BAD_REQUEST', message, details),
  unauthorized: (message = 'Not authenticated') =>
    new AppError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'Not allowed') => new AppError(403, 'FORBIDDEN', message),
  notFound: (resource: string) => new AppError(404, 'NOT_FOUND', `${resource} not found`),
  conflict: (message: string) => new AppError(409, 'CONFLICT', message),
  tooManyRequests: (message = 'Too many requests') =>
    new AppError(429, 'RATE_LIMITED', message),
  internal: (message = 'Internal server error') =>
    new AppError(500, 'INTERNAL', message),
};
