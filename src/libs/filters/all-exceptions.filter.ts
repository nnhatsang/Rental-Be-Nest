import { Response } from 'express';
import { ArgumentsHost, ExceptionFilter, Logger } from '@nestjs/common';
import { DATABASE_ERROR, ErrorResponse, UNKNOWN_ERROR } from '../constants/error.constants';

export class ErrorException implements ExceptionFilter {
  constructor() {}

  catch(e: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let code, message, error, status;

    if (e.code === 11000) {
      message = DATABASE_ERROR.message;
      code = DATABASE_ERROR.code;
      error = e.errorResponse?.errmsg;
      status = 500;
    } else if (e.response instanceof ErrorResponse) {
      message = e.response.message;
      code = e.response.code;
      error = e.options?.cause ?? undefined;
      status = e.status || 500;
    } else {
      message = UNKNOWN_ERROR.message;
      code = UNKNOWN_ERROR.code;
      error = e.message;
      status = e.status || 500;
    }

    new Logger().error(e);

    return res.status(status).json({ message, code, error });
  }
}
