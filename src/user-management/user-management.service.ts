import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, ILike } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserStatus } from '../infrastructure/database/entities';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PaginationDto, PaginationResponse } from '../shared/dto/pagination.dto';
import { EnhancedPaginationDto } from '../shared/dto/enhanced-pagination.dto';
import { EmailService } from '../shared/services/email.service';

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private emailService: EmailService,
  ) { }

  /**
   * Transform User entity to UserResponseDto
   * Removes password field from response
   */
  private transformUserToResponseDto(user: User): UserResponseDto {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as UserResponseDto;
  }

  async create(tenantId: string, createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const normalizedEmail = createUserDto.email.toLowerCase();

    // Check if email already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const user = this.userRepository.create({
      ...createUserDto,
      email: normalizedEmail,
      tenantId,
      password: hashedPassword,
      phoneNumber: createUserDto.phone,
    });

    const savedUser = await this.userRepository.save(user);

    // Load relations before transforming
    const userWithRelations = await this.userRepository.findOne({
      where: { id: savedUser.id },
      relations: ['tenant', 'restaurant'],
    });

    return this.transformUserToResponseDto(userWithRelations);
  }

  async findAll(tenantId: string, pagination: PaginationDto = { page: 1, limit: 10 }): Promise<PaginationResponse<UserResponseDto>> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;

    const [data, total] = await this.userRepository.findAndCount({
      where: { tenantId, status: UserStatus.ACTIVE }, // Only show active users by default
      relations: ['restaurant'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: data.map(user => this.transformUserToResponseDto(user)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAllWithFilters(tenantId: string, filters: EnhancedPaginationDto): Promise<PaginationResponse<UserResponseDto>> {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    // Build query builder
    const queryBuilder = this.userRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.restaurant', 'restaurant')
      .where('user.tenantId = :tenantId', { tenantId });

    // Apply search - search in name, email, phoneNumber
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      queryBuilder.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search OR user.phoneNumber ILIKE :search)',
        { search: searchTerm }
      );
    } else {
      // By default, only show active users if no search is provided
      queryBuilder.andWhere('user.status = :defaultStatus', { defaultStatus: UserStatus.ACTIVE });
    }

    // Apply filters
    if (filters.role) {
      queryBuilder.andWhere('user.role = :role', { role: filters.role });
    }

    if (filters.status) {
      queryBuilder.andWhere('user.status = :status', { status: filters.status });
    }

    if (filters.restaurantId) {
      queryBuilder.andWhere('user.restaurantId = :restaurantId', { restaurantId: filters.restaurantId });
    }

    // Apply sorting
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'DESC';
    const allowedSortFields = ['name', 'email', 'phoneNumber', 'role', 'status', 'createdAt', 'updatedAt', 'lastLoginAt'];
    const finalSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    queryBuilder.orderBy(`user.${finalSortBy}`, sortOrder as 'ASC' | 'DESC');

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const data = await queryBuilder.getMany();

    return {
      data: data.map(user => this.transformUserToResponseDto(user)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAllUsers(pagination: PaginationDto = { page: 1, limit: 10 }): Promise<PaginationResponse<UserResponseDto>> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;

    const [data, total] = await this.userRepository.findAndCount({
      where: { role: Not(UserRole.SUPER_ADMIN), status: UserStatus.ACTIVE }, // Only show active users by default
      relations: ['tenant', 'restaurant'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: data.map(user => this.transformUserToResponseDto(user)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAllUsersWithFilters(filters: EnhancedPaginationDto): Promise<PaginationResponse<UserResponseDto>> {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    // Build query builder
    const queryBuilder = this.userRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.tenant', 'tenant')
      .leftJoinAndSelect('user.restaurant', 'restaurant')
      .where('user.role != :superAdminRole', { superAdminRole: UserRole.SUPER_ADMIN });

    // Apply search - search in name, email, phoneNumber
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      queryBuilder.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search OR user.phoneNumber ILIKE :search)',
        { search: searchTerm }
      );
    } else {
      // By default, only show active users if no search is provided
      queryBuilder.andWhere('user.status = :defaultStatus', { defaultStatus: UserStatus.ACTIVE });
    }

    // Apply filters
    if (filters.role) {
      queryBuilder.andWhere('user.role = :role', { role: filters.role });
    }

    if (filters.status) {
      queryBuilder.andWhere('user.status = :status', { status: filters.status });
    }

    if (filters.tenantId) {
      queryBuilder.andWhere('user.tenantId = :tenantId', { tenantId: filters.tenantId });
    }

    if (filters.restaurantId) {
      queryBuilder.andWhere('user.restaurantId = :restaurantId', { restaurantId: filters.restaurantId });
    }

    // Apply sorting
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'DESC';
    const allowedSortFields = ['name', 'email', 'phoneNumber', 'role', 'status', 'createdAt', 'updatedAt', 'lastLoginAt'];
    const finalSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    queryBuilder.orderBy(`user.${finalSortBy}`, sortOrder as 'ASC' | 'DESC');

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const data = await queryBuilder.getMany();

    return {
      data: data.map(user => this.transformUserToResponseDto(user)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['tenant', 'restaurant'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.transformUserToResponseDto(user);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    currentUser: User,
  ): Promise<UserResponseDto> {
    // Find the user to update
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['tenant'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Role-based access control
    this.validateUserUpdateAccess(currentUser, user);

    // Prepare update data
    const updateData: any = {};

    // Check if email is being changed and already exists
    if (updateUserDto.email) {
      const normalizedEmail = updateUserDto.email.toLowerCase();

      if (normalizedEmail !== user.email) {
        const existingUser = await this.userRepository.findOne({
          where: { email: normalizedEmail },
        });

        if (existingUser) {
          throw new ConflictException('Email already exists');
        }
      }
      updateData.email = normalizedEmail;
    }

    if (updateUserDto.name !== undefined) {
      updateData.name = updateUserDto.name;
    }

    if (updateUserDto.phoneNumber !== undefined) {
      updateData.phoneNumber = updateUserDto.phoneNumber;
    }

    // Role changes - only super admin can change roles
    if (updateUserDto.role !== undefined) {
      if (currentUser.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('Only super admin can change user roles');
      }
      updateData.role = updateUserDto.role;
    }

    // Status changes - only super admin can change status
    if (updateUserDto.status !== undefined) {
      if (currentUser.role !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('Only super admin can change user status');
      }
      updateData.status = updateUserDto.status;
    }

    if (updateUserDto.restaurantId !== undefined) {
      updateData.restaurantId = updateUserDto.restaurantId;
    }

    if (updateUserDto.avatar !== undefined) {
      updateData.avatar = updateUserDto.avatar;
    }

    // Apply updates
    Object.assign(user, updateData);
    const savedUser = await this.userRepository.save(user);

    // Load relations before transforming
    const userWithRelations = await this.userRepository.findOne({
      where: { id: savedUser.id },
      relations: ['tenant', 'restaurant'],
    });

    return this.transformUserToResponseDto(userWithRelations);
  }

  private validateUserUpdateAccess(currentUser: User, targetUser: User): void {
    // Super admin can update anyone
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      return;
    }

    // Tenant admin can only update users in their tenant
    if (currentUser.role === UserRole.TENANT_ADMIN) {
      if (currentUser.tenantId !== targetUser.tenantId) {
        throw new ForbiddenException('Cannot update user from different tenant');
      }

      // Tenant admin can only update managers and cashiers
      const allowedRoles = [UserRole.MANAGER, UserRole.CASHIER];
      if (!allowedRoles.includes(targetUser.role)) {
        throw new ForbiddenException(
          'Tenant admin can only update managers and cashiers'
        );
      }
      return;
    }

    // Other roles cannot update users
    throw new ForbiddenException('Insufficient permissions to update user');
  }

  async archive(id: string, currentUser?: User): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['tenant', 'restaurant'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (currentUser) {
      this.validateArchiveAccess(currentUser, user);
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new BadRequestException('User is already archived');
    }

    user.status = UserStatus.INACTIVE;
    const savedUser = await this.userRepository.save(user);

    // Load relations before transforming
    const userWithRelations = await this.userRepository.findOne({
      where: { id: savedUser.id },
      relations: ['tenant', 'restaurant'],
    });

    return this.transformUserToResponseDto(userWithRelations);
  }

  async unarchive(id: string, currentUser?: User): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['tenant', 'restaurant'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (currentUser) {
      this.validateArchiveAccess(currentUser, user);
    }

    if (user.status !== UserStatus.INACTIVE) {
      throw new BadRequestException('User is not archived. Only archived users can be unarchived.');
    }

    user.status = UserStatus.ACTIVE;
    const savedUser = await this.userRepository.save(user);

    // Load relations before transforming
    const userWithRelations = await this.userRepository.findOne({
      where: { id: savedUser.id },
      relations: ['tenant', 'restaurant'],
    });

    return this.transformUserToResponseDto(userWithRelations);
  }

  async reactivate(id: string, currentUser?: User): Promise<UserResponseDto> {
    return this.unarchive(id, currentUser);
  }

  private validateArchiveAccess(currentUser: User, targetUser: User): void {
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      return;
    }

    if (currentUser.role === UserRole.TENANT_ADMIN) {
      if (currentUser.tenantId !== targetUser.tenantId) {
        throw new ForbiddenException('Cannot modify user from different tenant');
      }

      if (targetUser.role === UserRole.SUPER_ADMIN || targetUser.role === UserRole.TENANT_ADMIN) {
        throw new ForbiddenException('Tenant admin cannot archive or delete other admins');
      }

      return;
    }

    throw new ForbiddenException('Insufficient permissions to archive or delete user');
  }

  /**
   * Reset user password and return cleartext temporary password
   */
  async resetPassword(
    userId: string,
    currentUser: User,
    tenantId?: string,
    dto?: ResetPasswordDto,
  ): Promise<any> {
    // Find the user
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['tenant'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (tenantId && user.tenantId && user.tenantId !== tenantId) {
      throw new BadRequestException('User does not belong to the specified tenant');
    }

    // Only allow password reset for staff roles
    const allowedRoles = [
      UserRole.SUPER_ADMIN,
      UserRole.TENANT_ADMIN,
      UserRole.MANAGER,
      UserRole.CASHIER,
    ];

    if (!allowedRoles.includes(user.role)) {
      throw new BadRequestException('Password reset is only available for staff users');
    }

    // Check permissions
    this.validatePasswordResetAccess(currentUser, user);

    // Resolve cleartext password (custom provided or generated readable format)
    const temporaryPassword =
      dto?.newPassword ||
      dto?.temporaryPassword ||
      dto?.password ||
      this.generateReadablePassword(user);

    this.logger.log(`Setting password for user ${user.email} (${user.name})`);

    // Hash the temporary password
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    // Update user password
    user.password = hashedPassword;
    await this.userRepository.save(user);

    this.logger.log(`Password reset completed for user ${user.email} (${user.name})`);

    // Send email asynchronously in background (fire-and-forget) so SMTP delays never block HTTP response
    if (this.emailService) {
      this.emailService
        .sendPasswordResetEmail(user.email, user.name, temporaryPassword)
        .then(() => {
          this.logger.log(`Password reset email sent to ${user.email}`);
        })
        .catch((error) => {
          this.logger.warn(`⚠️ Email delivery skipped/failed for ${user.email}: ${error.message}`);
        });
    }

    return {
      success: true,
      message: 'Password reset successfully',
      data: {
        id: user.id,
        tenantId: user.tenantId,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        status: user.status,
        temporaryPassword,
      },
    };
  }

  /**
   * Validate if current user can reset password for target user
   */
  private validatePasswordResetAccess(currentUser: User, targetUser: User): void {
    // Super admin can reset anyone's password
    if (currentUser.role === UserRole.SUPER_ADMIN) {
      return;
    }

    // Tenant admin can reset passwords for users in their tenant
    if (currentUser.role === UserRole.TENANT_ADMIN) {
      if (currentUser.tenantId !== targetUser.tenantId) {
        throw new ForbiddenException('Cannot reset password for user from different tenant');
      }

      // Tenant admin cannot reset super admin or other tenant admin passwords
      if (targetUser.role === UserRole.SUPER_ADMIN || targetUser.role === UserRole.TENANT_ADMIN) {
        throw new ForbiddenException('Insufficient permissions to reset this user\'s password');
      }

      return;
    }

    // Manager can reset passwords for staff in their tenant (cashiers)
    if (currentUser.role === UserRole.MANAGER) {
      if (currentUser.tenantId !== targetUser.tenantId) {
        throw new ForbiddenException('Cannot reset password for user from different tenant');
      }

      if (
        targetUser.role === UserRole.SUPER_ADMIN ||
        targetUser.role === UserRole.TENANT_ADMIN ||
        targetUser.role === UserRole.MANAGER
      ) {
        throw new ForbiddenException('Managers cannot reset passwords for admins or other managers');
      }

      return;
    }

    // Other roles cannot reset passwords
    throw new ForbiddenException('Insufficient permissions to reset passwords');
  }

  /**
   * Generate a human-readable, secure temporary password (e.g. John#4829)
   */
  private generateReadablePassword(user: User): string {
    const rawFirstName = (user.name || 'Staff').trim().split(/\s+/)[0].replace(/[^a-zA-Z]/g, '') || 'Staff';
    const capitalized = rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1).toLowerCase();
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    return `${capitalized}#${randomDigits}`;
  }

  /**
   * Generate a secure temporary password
   * Format: 8 characters with uppercase, lowercase, and numbers
   */
  private generateTemporaryPassword(): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const allChars = uppercase + lowercase + numbers;

    let password = '';

    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];

    // Fill the rest randomly
    for (let i = 3; i < 8; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }
}
