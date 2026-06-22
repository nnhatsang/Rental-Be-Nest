import { Request, Response } from 'express';
import { ArgumentsHost, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { DATABASE_ERROR, ErrorResponse, FORBIDDEN, UNAUTHORIZED, UNKNOWN_ERROR } from '../constants/error.constants';
import { Prisma } from '@generated/prisma/client';

export class ErrorException implements ExceptionFilter {
  private readonly logger = new Logger(ErrorException.name);

  constructor() {}

  catch(e: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const { code, message, error, status } = this.toErrorBody(e);

    this.logger.error(`${req.method} ${req.url}`, e?.stack ?? e);

    return res.status(status).json({
      message,
      code,
      ...(error !== undefined && { error }),
    });
  }

  private toErrorBody(e: any) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') {
        return {
          message: DATABASE_ERROR.message,
          code: DATABASE_ERROR.code,
          error: e.message,
          status: HttpStatus.BAD_REQUEST,
        };
      }

      if (e.code === 'P2025') {
        return {
          message: 'Không tìm thấy bản ghi yêu cầu hoặc bản ghi đã bị xóa',
          code: 'RECORD_NOT_FOUND',
          error: e.message,
          status: HttpStatus.NOT_FOUND,
        };
      }

      if (e.code === 'P2003') {
        return {
          message: 'Dữ liệu liên kết không hợp lệ hoặc đang được sử dụng ở bảng khác',
          code: 'DATABASE_RELATION_ERROR',
          error: e.message,
          status: HttpStatus.BAD_REQUEST,
        };
      }

      return {
        message: DATABASE_ERROR.message,
        code: DATABASE_ERROR.code,
        error: e.message,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    if (e?.code === 11000) {
      return {
        message: DATABASE_ERROR.message,
        code: DATABASE_ERROR.code,
        error: e.errorResponse?.errmsg,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    if (e instanceof HttpException) {
      const status = e.getStatus();
      const response = e.getResponse();
      const cause = (e as Error & { cause?: unknown }).cause;

      if (response instanceof ErrorResponse) {
        return {
          message: response.message,
          code: response.code,
          error: cause,
          status,
        };
      }

      if (this.isErrorResponseLike(response)) {
        return {
          message: response.message,
          code: response.code,
          error: cause ?? response.error,
          status,
        };
      }

      return {
        message: this.getHttpErrorMessage(status, response),
        code: this.getHttpErrorCode(status, response),
        error: this.getHttpErrorDetail(response, e.message),
        status,
      };
    }

    return {
      message: UNKNOWN_ERROR.message,
      code: UNKNOWN_ERROR.code,
      error: e?.message,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    };
  }

  private isErrorResponseLike(response: unknown): response is ErrorResponse & { error?: unknown } {
    return (
      typeof response === 'object' &&
      response !== null &&
      'code' in response &&
      'message' in response &&
      typeof (response as { code?: unknown }).code === 'string' &&
      typeof (response as { message?: unknown }).message === 'string'
    );
  }

  private getHttpErrorCode(status: number, response: unknown): string {
    if (status === HttpStatus.UNAUTHORIZED) {
      return UNAUTHORIZED.code;
    }

    if (status === HttpStatus.FORBIDDEN) {
      return FORBIDDEN.code;
    }

    if (typeof response === 'object' && response !== null && 'error' in response) {
      const error = (response as { error?: unknown }).error;
      if (typeof error === 'string') {
        return error.toUpperCase().replace(/\s+/g, '_');
      }
    }

    return `HTTP_${status}`;
  }

  private getHttpErrorMessage(status: number, response: unknown): string {
    // if (status === HttpStatus.UNAUTHORIZED) {
    //   return UNAUTHORIZED.message;
    // }

    // if (status === HttpStatus.FORBIDDEN) {
    //   return FORBIDDEN.message;
    // }

    if (typeof response === 'object' && response !== null && 'message' in response) {
      const message = (response as { message?: unknown }).message;
      if (Array.isArray(message)) {
        return message[0] ?? UNKNOWN_ERROR.message;
      }

      if (typeof message === 'string') {
        return message;
      }
    }

    return UNKNOWN_ERROR.message;
  }

  private getHttpErrorDetail(response: unknown, fallback?: string): unknown {
    if (typeof response === 'object' && response !== null && 'error' in response) {
      return (response as { error?: unknown }).error;
    }

    return fallback;
  }
}
