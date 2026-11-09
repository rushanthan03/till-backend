import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { GenericTypeOrmRepository } from '../database/typeorm/generic-typeorm.repository';
import { throwApplicationError } from '../utilities/exception-instance';
import { saltRounds } from './../../application/constants/constants';
import { Result } from './../../domain/result/result';
import { IJwtPayload, ISignUpTokens, IUserPayload } from './interfaces/auth.interface';

/**
 *Authentication service class
 *
 * @exports
 * @class AuthService
 * @implements {IAuthService}
 */
@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService, private readonly configService: ConfigService) {}

  /**
   * method to generate access and refresh token
   *
   * @param {IUserPayload} payload
   * @returns {Promise<ISignUpTokens>}
   * @memberof AuthService
   */
  protected async generateAuthTokens(payload: IUserPayload): Promise<ISignUpTokens> {
    const { userId, email, role } = payload;
    const jwtPayload: IJwtPayload = {
      sub: userId,
      email,
      role,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(jwtPayload),
      this.signRefreshToken(jwtPayload),
    ]);

    return {
      refreshToken,
      accessToken,
    };
  }

  /**
   * method to sign access token
   *
   * @param {IJwtPayload} jwtPayload
   * @returns {Promise<string>}
   * @memberof AuthService
   */
  protected async signAccessToken(jwtPayload: IJwtPayload): Promise<string> {
    return this.jwtService.signAsync(jwtPayload, {
      secret: this.configService.get<string>('JWT_ACCESS_TOKEN_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION_TIME'),
    });
  }

  /**
   * method to sign refresh token
   *
   * @param {IJwtPayload} jwtPayload
   * @returns {Promise<string>}
   * @memberof AuthService
   */
  protected async signRefreshToken(jwtPayload: IJwtPayload): Promise<string> {
    return this.jwtService.signAsync(jwtPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION_TIME'),
    });
  }

  /**
   * method to hash tokens
   *
   * @param {string} prop
   * @param {number} saltRound
   * @returns {Promise<string>}
   * @memberof AuthService
   */
  protected async hashData(prop: string, saltRound: number): Promise<string> {
    return bcrypt.hash(prop, saltRound);
  }

  /**
   * Generic method to update refresh token
   *
   * @param {GenericanyRepository<any>} model
   * @param {string} userId
   * @param {string} refreshToken
   * @returns {Promise<{ accessToken: string }>}
   * @memberof AuthService
   */
  protected async updateRefreshToken(
    model: GenericTypeOrmRepository<any, any>,
    userId: string,
    refreshToken: string,
  ): Promise<{ accessToken: string }> {
    const result: Result<any | null> = await model.findById(userId);

    if (result.isSuccess === false) {
      throwApplicationError(HttpStatus.FORBIDDEN, 'Access denied');
    }
    const userEntity = await result.getValue();
    const { refreshTokenHash, role, email } = userEntity;
    const verifyToken = await bcrypt.compare(refreshToken, refreshTokenHash);

    if (!verifyToken) {
      throwApplicationError(HttpStatus.FORBIDDEN, 'Access denied');
      this.nullifyRefreshToken(model, userId);
    }

    const payload = { userId, email, role };
    const newTokens = await this.generateAuthTokens(payload);
    const tokenHash = await this.hashData(newTokens.refreshToken, saltRounds);

    await model.findOneAndUpdate({ _id: userEntity.id }, { refreshTokenHash: tokenHash });

    return {
      accessToken: newTokens.accessToken,
    };
  }

  /**
   * method to log Out On Security Breach
   *
   * @param {GenericanyRepository<any>} model
   * @param {string} userId
   * @returns {void}
   * @memberof AuthService
   */
  protected async nullifyRefreshToken(model: GenericTypeOrmRepository<any, any>, userId: string) {
    const docResult: Result<any | null> = await model.findById(userId);

    if (docResult) {
      await model.findOneAndUpdate(
        {
          id: userId,
        },
        { refreshTokenHash: null },
      );
    }
  }

  /**
   * method to log Out On Security Breach
   *
   * @param {GenericanyRepository<any>} model
   * @param {string} userId
   * @returns {void}
   * @memberof AuthService
   */
  protected async logOut(model: GenericTypeOrmRepository<any, any>, userId: string) {
    let result: Result<any | null> = await model.findById(userId);

    if (result.isSuccess === false) {
      throwApplicationError(HttpStatus.NOT_FOUND, 'User does not exist');
    }
    const user = await result.getValue();

    if (result && user.refreshTokenHash !== undefined && user.refreshTokenHash !== null) {
      result = await model.findOneAndUpdate(
        {
          id: userId,
        },
        { refreshTokenHash: null },
      );
      if (result.isSuccess === false) {
        throwApplicationError(HttpStatus.INTERNAL_SERVER_ERROR, 'Unable to update data');
      }
    }
  }

  // Add missing methods for auth controller
  async login(loginDto: any): Promise<any> {
    throw new Error('Method not implemented');
  }

  async register(registerDto: any): Promise<any> {
    throw new Error('Method not implemented');
  }

  async sendOtp(phoneLoginDto: any): Promise<any> {
    throw new Error('Method not implemented');
  }

  async verifyOtp(verifyOtpDto: any): Promise<any> {
    throw new Error('Method not implemented');
  }

  async refreshToken(refreshTokenDto: any): Promise<any> {
    throw new Error('Method not implemented');
  }

  async logout(userId: string): Promise<void> {
    throw new Error('Method not implemented');
  }

  async validateUserById(userId: string): Promise<any> {
    throw new Error('Method not implemented');
  }
}
