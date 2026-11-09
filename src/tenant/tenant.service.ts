import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant, TenantStatus, TenantType, SubscriptionPlan } from '../infrastructure/database/entities';
import { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto';
import { PaginationDto, PaginationResponse } from '../shared/dto/pagination.dto';
import { EnhancedPaginationDto } from '../shared/dto/enhanced-pagination.dto';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) { }

  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    // Check if tenant name already exists
    const existingTenant = await this.tenantRepository.findOne({ where: { name: createTenantDto.name } });
    if (existingTenant) {
      throw new ConflictException(`Tenant with name "${createTenantDto.name}" already exists`);
    }

    // Generate subdomain from name
    const subdomain = createTenantDto.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Check if subdomain already exists
    let finalSubdomain = subdomain;
    let counter = 1;
    while (await this.tenantRepository.findOne({ where: { subdomain: finalSubdomain } })) {
      finalSubdomain = `${subdomain}-${counter}`;
      counter++;
    }

    const tenant = this.tenantRepository.create({
      ...createTenantDto,
      subdomain: finalSubdomain,
    });

    try {
      return await this.tenantRepository.save(tenant);
    } catch (error) {
      // Handle unique constraint violations
      if (error.code === '23505') { // PostgreSQL unique violation error code
        if (error.detail?.includes('name')) {
          throw new ConflictException(`Tenant with name "${createTenantDto.name}" already exists`);
        }
        if (error.detail?.includes('subdomain')) {
          throw new ConflictException(`Tenant with subdomain "${finalSubdomain}" already exists`);
        }
        throw new ConflictException('A tenant with this information already exists');
      }
      throw error;
    }
  }

  async findAll(pagination: PaginationDto = { page: 1, limit: 10 }): Promise<PaginationResponse<Tenant>> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;

    // Show all tenants regardless of status (including inactive/archived)
    const [data, total] = await this.tenantRepository.findAndCount({
      relations: ['restaurants', 'users'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findAllWithFilters(filters: EnhancedPaginationDto): Promise<PaginationResponse<Tenant>> {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    // Build query builder
    const queryBuilder = this.tenantRepository.createQueryBuilder('tenant')
      .leftJoinAndSelect('tenant.restaurants', 'restaurants')
      .leftJoinAndSelect('tenant.users', 'users');

    // Apply search - search in name, subdomain, contactEmail, description
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      queryBuilder.where(
        '(tenant.name ILIKE :search OR tenant.subdomain ILIKE :search OR tenant.contactEmail ILIKE :search OR tenant.description ILIKE :search)',
        { search: searchTerm }
      );
    }
    // Note: Removed default ACTIVE filter - now shows all tenants unless status is explicitly specified

    // Apply status filter only if explicitly provided (not empty string)
    if (filters.status && filters.status.trim() !== '') {
      queryBuilder.andWhere('tenant.status = :status', { status: filters.status });
    }

    if (filters.type) {
      queryBuilder.andWhere('tenant.type = :type', { type: filters.type });
    }

    if (filters.subscriptionPlan) {
      queryBuilder.andWhere('tenant.subscriptionPlan = :subscriptionPlan', { subscriptionPlan: filters.subscriptionPlan });
    }

    // Filter by city
    if (filters.city) {
      queryBuilder.andWhere("tenant.address ->> 'city' = :city", { city: filters.city });
    }

    // Filter by district
    if (filters.district) {
      queryBuilder.andWhere("tenant.address ->> 'district' = :district", { district: filters.district });
    }

    // Apply sorting
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'DESC';
    const allowedSortFields = ['name', 'subdomain', 'status', 'type', 'subscriptionPlan', 'createdAt', 'updatedAt'];
    const finalSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    queryBuilder.orderBy(`tenant.${finalSortBy}`, sortOrder as 'ASC' | 'DESC');

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const data = await queryBuilder.getMany();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { id },
      relations: ['restaurants', 'users'],
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findOne(id);
    Object.assign(tenant, updateTenantDto);
    return this.tenantRepository.save(tenant);
  }

  async archive(id: string): Promise<{ message: string }> {
    const tenant = await this.findOne(id);
    tenant.status = TenantStatus.INACTIVE;
    await this.tenantRepository.save(tenant);
    return { message: 'Tenant archived successfully' };
  }

  async unarchive(id: string): Promise<Tenant> {
    const tenant = await this.findOne(id);
    if (tenant.status !== TenantStatus.INACTIVE) {
      throw new BadRequestException('Tenant is not archived. Only archived tenants can be unarchived.');
    }
    tenant.status = TenantStatus.ACTIVE;
    return this.tenantRepository.save(tenant);
  }

  async reactivate(id: string): Promise<Tenant> {
    return this.unarchive(id);
  }

  async toggleStatus(id: string): Promise<Tenant> {
    const tenant = await this.findOne(id);

    // Toggle between ACTIVE and INACTIVE
    if (tenant.status === TenantStatus.ACTIVE) {
      tenant.status = TenantStatus.INACTIVE;
    } else {
      tenant.status = TenantStatus.ACTIVE;
    }

    return this.tenantRepository.save(tenant);
  }

  /**
   * Get simple list of all tenants with only id and name
   * No pagination, no relations, just id and name for dropdown/selection purposes
   */
  async findAllSimple(search?: string): Promise<Array<{ id: string; name: string }>> {
    // Use raw SQL to avoid TypeORM entity metadata issues in production
    let query = 'SELECT id, name FROM tenants ORDER BY name ASC';
    const params: any[] = [];

    if (search && search.trim() !== '') {
      query = 'SELECT id, name FROM tenants WHERE name ILIKE $1 ORDER BY name ASC';
      params.push(`%${search}%`);
    }

    const result = await this.tenantRepository.query(query, params);
    return result;
  }

  async searchTenants(keyword?: string): Promise<Array<{ id: string; tenantName: string }>> {
    try {
      const queryBuilder = this.tenantRepository.createQueryBuilder('tenant')
        .select(['tenant.id', 'tenant.name']);

      if (keyword && keyword.trim() !== '') {
        queryBuilder.where('(tenant.name ILIKE :keyword OR tenant.subdomain ILIKE :keyword)', {
          keyword: `%${keyword}%`
        });
      }

      queryBuilder.orderBy('tenant.name', 'ASC');

      const results = await queryBuilder.getMany();

      return results.map(tenant => ({
        id: tenant.id,
        tenantName: tenant.name
      }));
    } catch (error) {
      console.error('[TenantService] searchTenants error:', error);
      throw error;
    }
  }
}
