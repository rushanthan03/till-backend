import { IContextService } from './../context/context-service.interface';
import { TYPES } from './../../application/constants/types';
import { APIResponseMessage } from './../../application/constants/constants';
import { Regex } from './../utilities/regex';
import { HttpStatus, Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Context } from '../context/context';
import { throwApplicationError } from '../utilities/exception-instance';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class ContextMiddleWare implements NestMiddleware {
  constructor(
    @Inject(TYPES.IContextService)
    private readonly contextService: IContextService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}
  use(req: Request, res: Response, next: NextFunction) {
    const headers = req.headers;
    const errors = new Object() as any;
    // if (!Object.hasOwn(headers, APIResponseMessage.emailHeader)) {
    //   errors.email = APIResponseMessage.emailHeaderError;
    // }
    // Make correlationId optional for backward compatibility
    // if (!Object.hasOwnProperty.call(headers, APIResponseMessage.correlationIdHeader)) {
    //   errors.correlationId = APIResponseMessage.correlationIdHeaderError;
    // }
    for (const [key, value] of Object.entries(headers)) {
      if (key === APIResponseMessage.emailHeader) {
        const isValidEmail = Regex.isEmail(value.toString());
        if (!isValidEmail) errors.email = APIResponseMessage.invalidEmailHeaderError;
      }

      if (key === APIResponseMessage.correlationIdHeader) {
        if (typeof value !== 'string') errors.correlationId = APIResponseMessage.invalidCorrelationId;
      }

      if (Object.getOwnPropertyNames(errors).length) {
        throwApplicationError(HttpStatus.BAD_REQUEST, errors);
      }
    }
    let email =
      (req.headers[APIResponseMessage.emailHeader] as string) ?? this.configService.get<string>('GUEST_EMAIL');
    let role = (req.headers[APIResponseMessage.roleHeader] as string) ?? '';
    const correlationId = (req.headers[APIResponseMessage.correlationIdHeader] as string) ?? '';
    const authHeader = req.headers[APIResponseMessage.authorizationHeader] as string;

    if ((!email || !role) && authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = this.jwtService.decode(token) as any;
      if (decoded) {
        email = email || decoded.email || this.configService.get<string>('GUEST_EMAIL');
        role = role || decoded.role || '';
      }
    }
    const context: Context = new Context(email, correlationId, authHeader ?? '', role);
    this.contextService.setContext(context);
    next();
  }
}
