import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DataSource } from 'typeorm';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const { method, url, ip, user } = request;

    // Log all CRUD actions: Create (POST), Read (GET), Update (PUT/PATCH), Delete (DELETE)
    const crudMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    if (!crudMethods.includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async () => {
        try {
          const userId = user?.id ?? null;
          const action = `${method} ${url}`;
          
          // Clean sensitive information from body if any before logging
          const logBody = { ...request.body };
          if (logBody.password) delete logBody.password;
          if (logBody.passwordConfirm) delete logBody.passwordConfirm;

          const details = {
            body: logBody,
            params: request.params,
            query: request.query,
          };

          // Write directly to database using DataSource raw query to prevent circular module dependencies
          await this.dataSource.query(
            `INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)`,
            [userId, action, JSON.stringify(details), ip],
          );
        } catch (error) {
          // Do not fail the client request if audit logging fails
          console.error('Audit Log Interceptor error:', error);
        }
      }),
    );
  }
}
