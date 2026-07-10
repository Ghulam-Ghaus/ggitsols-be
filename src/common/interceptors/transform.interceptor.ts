import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
  metadata: {
    timestamp: string;
    path: string;
    userId?: number | string;
  };
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data: data ?? null,
        metadata: {
          timestamp: new Date().toISOString(),
          path: request.url,
          userId: request.user?.id ?? null,
        },
      })),
    );
  }
}
