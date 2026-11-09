import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User, Restaurant, UserRole, UserStatus } from '../database/entities';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto';
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
      throw new UnauthorizedException('Invalid credentials');
    }

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

    const tokens = await this.generateTokens(user);


    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
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
    const { password, refreshToken, refreshTokenExpiresAt, ...sanitized } = user;
    if (sanitized.restaurant) {
      sanitized.restaurant = {
        ...sanitized.restaurant,
      };
    }
    return sanitized;
  }

}
