import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
@Catch(Prisma.PrismaClientKnownRequestError)
export class GovernmentErrorFilter implements ExceptionFilter {
  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const status =
      error.code === 'P2025'
        ? 404
        : error.code === 'P2002'
          ? 409
          : error.code === 'P2003'
            ? 400
            : 500;
    const message =
      status === 404
        ? 'Record not found'
        : status === 409
          ? 'This record already exists; refresh and retry'
          : status === 400
            ? 'Referenced record is missing or still in use'
            : 'Database operation failed';
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message });
  }
}
