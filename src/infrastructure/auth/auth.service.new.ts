import { AuditLogService } from '../../audit-log/audit-log.service';
import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User, Restaurant, UserRole, UserStatus } from '../database/entities';
import { LoginDto, PinLoginDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto';
import { AuthResponseDto, TokenResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Restaurant)
    private restaurantRepository: Repository<Restaurant>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private audit: AuditLogService,
  ) { }

  async validateUser(email: string, password: string): Promise<any> {
    const normalizedEmail = email.toLowerCase();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
      relations: ['tenant', 'restaurant'],
    });

    if (user && await bcrypt.compare(password, user.password)) {
      if (!user.restaurant && user.tenantId) {
        user.restaurant = await this.restaurantRepository.findOne({
          where: { tenantId: user.tenantId },
          order: { createdAt: 'ASC' } as any,
        });
      }
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async validateUserById(id: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['tenant'],
    });

    if (user) {
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      // Only logged when the account exists: the log belongs to that person's company.
      const known = await this.userRepository.findOne({ where: { email: loginDto.email.toLowerCase() }, select: ['id', 'name', 'email', 'role', 'tenantId', 'restaurantId'] });
      if (known) await this.audit.record({ actor: known, storeId: known.restaurantId ?? null, action: 'auth.login_failed', entityType: 'user', entityId: known.id, summary: `Wrong password for ${known.email ?? loginDto.email.toLowerCase()}` });
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.finishLogin(user, `Signed in with email (${user.email})`);
  }

  /** Everything after the credentials are known to be right: account checks, last-login stamp and tokens. */
  private async finishLogin(user: any, how: string): Promise<AuthResponseDto> {
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    // Super Admin can login without tenant restriction
    // Other roles must have a tenant (except if they are system-level users)
    if (user.role !== UserRole.SUPER_ADMIN && !user.tenantId) {
      throw new UnauthorizedException('User must be associated with a tenant');
    }

    // Check that the user's store is active (if the user is assigned to one)
    if (user.restaurantId && user.restaurant) {
      if (user.restaurant.status === 'inactive') {
        throw new UnauthorizedException('This store is archived. Please contact support.');
      }
      if (!user.restaurant.isActive) {
        throw new UnauthorizedException('This store is not active. Please contact support.');
      }
    }

    // Update last login
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });
    await this.audit.record({ actor: user, storeId: user.restaurantId ?? null, action: 'auth.login', entityType: 'user', entityId: user.id, summary: how });

    const tokens = await this.generateTokens(user);


    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  /** Failed PIN attempts per employee (in memory: resets on restart, enough to stop someone guessing PINs at a till). */
  private pinFailures = new Map<string, { count: number; lockedUntil: number }>();

  /**
   * Quick sign-in at the till: employee number + PIN instead of email + password.
   * Five wrong tries lock that employee number for five minutes.
   */
  async pinLogin(dto: PinLoginDto): Promise<AuthResponseDto> {
    const key = `${dto.tenantId}:${dto.employeeNumber}`;
    const f = this.pinFailures.get(key);
    if (f && f.lockedUntil > Date.now()) throw new UnauthorizedException('Too many wrong PIN attempts. Try again in a few minutes.');

    const user = await this.userRepository
      .createQueryBuilder('u')
      .addSelect('u.pinHash')
      .leftJoinAndSelect('u.tenant', 'tenant')
      .leftJoinAndSelect('u.restaurant', 'restaurant')
      .where('u.tenantId = :tenantId AND u.employeeNumber = :n', { tenantId: dto.tenantId, n: dto.employeeNumber })
      .getOne();

    // compare even when the employee does not exist, so response time does not reveal which numbers are in use
    const ok = await bcrypt.compare(dto.pin, user?.pinHash ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');
    if (!user || !user.pinHash || !ok || user.role === UserRole.SUPER_ADMIN) {
      const count = (f && f.lockedUntil <= Date.now() ? f.count : 0) + 1;
      this.pinFailures.set(key, { count, lockedUntil: count >= 5 ? Date.now() + 5 * 60 * 1000 : 0 });
      await this.audit.record({
        actor: user && user.role !== UserRole.SUPER_ADMIN ? user : null,
        tenantId: dto.tenantId,
        storeId: user?.restaurantId ?? null,
        action: 'auth.login_failed',
        summary: `Wrong till PIN for employee number ${dto.employeeNumber}${count >= 5 ? '; locked for 5 minutes' : ''}`,
      });
      throw new UnauthorizedException('Invalid employee number or PIN');
    }
    this.pinFailures.delete(key);
    if (!user.restaurant && user.tenantId) {
      user.restaurant = await this.restaurantRepository.findOne({ where: { tenantId: user.tenantId }, order: { createdAt: 'ASC' } as any });
    }
    const { password: _pw, ...result } = user as any;
    return this.finishLogin(result, `Signed in at the till with employee number ${dto.employeeNumber}`);
  }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const normalizedEmail = registerDto.email.toLowerCase();

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = this.userRepository.create({
      email: normalizedEmail,
      password: hashedPassword,
      name: registerDto.name,
      role: registerDto.role,
      tenantId: registerDto.tenantId,
      phoneNumber: registerDto.phoneNumber || null,
      restaurantId: registerDto.restaurantId || null,

    });

    const savedUser = await this.userRepository.save(user);
    const tokens = await this.generateTokens(savedUser);

    return {
      user: this.sanitizeUser(savedUser),
      ...tokens,
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<TokenResponseDto> {
    try {
      // Verify the refresh token signature and expiration
      const payload = this.jwtService.verify(refreshTokenDto.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
      });

      // Find user by ID from token payload
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Check if refresh token exists in database
      if (!user.refreshToken) {
        throw new UnauthorizedException('Refresh token not found. Please login again.');
      }

      // Check if refresh token has expired
      if (user.refreshTokenExpiresAt && new Date() > user.refreshTokenExpiresAt) {
        // Clear expired token
        await this.userRepository.update(user.id, {
          refreshToken: null,
          refreshTokenExpiresAt: null,
        });
        throw new UnauthorizedException('Refresh token has expired. Please login again.');
      }

      // Verify the token matches the one stored in database
      if (user.refreshToken !== refreshTokenDto.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      return tokens;
    } catch (error) {
      // If it's already an UnauthorizedException, re-throw it
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // For JWT errors (expired, invalid signature, etc.), throw a generic error
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      refreshToken: null,
      refreshTokenExpiresAt: null,
    });

  }

  private async generateTokens(user: User): Promise<TokenResponseDto> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId || null, // Super Admin has null tenantId
      restaurantId: user.restaurantId || null,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_TOKEN_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION_TIME'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION_TIME'),
    });

    // Calculate refresh token expiration date from JWT expiration
    const refreshTokenExpirationTime = this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION_TIME');
    const refreshTokenExpiresAt = new Date();

    // Parse expiration time (e.g., "7d", "604800s", etc.)
    if (refreshTokenExpirationTime.endsWith('d')) {
      const days = parseInt(refreshTokenExpirationTime);
      refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + days);
    } else if (refreshTokenExpirationTime.endsWith('h')) {
      const hours = parseInt(refreshTokenExpirationTime);
      refreshTokenExpiresAt.setHours(refreshTokenExpiresAt.getHours() + hours);
    } else {
      // Default to seconds
      const seconds = parseInt(refreshTokenExpirationTime) || 604800; // Default 7 days
      refreshTokenExpiresAt.setSeconds(refreshTokenExpiresAt.getSeconds() + seconds);
    }

    // Store refresh token in database
    await this.userRepository.update(user.id, {
      refreshToken,
      refreshTokenExpiresAt,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }

  private sanitizeUser(user: User): any {
    const { password, refreshToken, refreshTokenExpiresAt, pinHash, ...sanitized } = user as any;
    if (sanitized.restaurant) {
      sanitized.restaurant = {
        ...sanitized.restaurant,
      };
    }
    return sanitized;
  }

}
