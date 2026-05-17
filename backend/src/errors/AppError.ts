export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly isOperational = true,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('validation_error', message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super('not_found', message, 404);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super('database_error', message, 500);
  }
}
