import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'object' && res['message'] ? res['message'] : res;
    } else {
      // Catch common PostgreSQL/TypeORM constraint violations
      const error = exception as any;
      if (error && error.code) {
        switch (error.code) {
          case '23505': // Unique violation
            status = HttpStatus.CONFLICT;
            message = 'A record with this identifier already exists.';
            break;
          case '23503': // Foreign key violation
            status = HttpStatus.BAD_REQUEST;
            message = 'Referenced relational record was not found.';
            break;
          case '23502': // Not null violation
            status = HttpStatus.BAD_REQUEST;
            message = 'Required database field is missing.';
            break;
          default:
            console.error('Database unhandled error:', error);
            message = 'Database operation failed';
        }
      } else {
        console.error('Unhandled runtime error:', exception);
      }
    }

    response.status(status).json({
      success: false,
      error: {
        statusCode: status,
        message: Array.isArray(message) ? message.join(', ') : message,
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }
}
