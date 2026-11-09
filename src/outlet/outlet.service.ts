import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Restaurant } from '../infrastructure/database/entities';
import { CreateOutletDto, UpdateOutletDto } from './dto';
import { PaginationDto, PaginationResponse } from '../shared/dto/pagination.dto';
import { S3Service } from '@/shared/services/s3.service';
import { RestaurantService } from '@/restaurant';

@Injectable()
export class OutletService {
  private readonly logger = new Logger(OutletService.name);
  constructor(
    @InjectRepository(Restaurant)
    private restaurantRepository: Repository<Restaurant>,
    private readonly s3Service: S3Service,
    private readonly restaurantService: RestaurantService,
  ) { }

  async create(tenantId: string, createOutletDto: CreateOutletDto): Promise<{ message: string; data: Restaurant }> {
    const outlet = this.restaurantRepository.create({
      ...createOutletDto,
      tenantId,
      status: 'active', // Ensure new outlets are created as active
    } as DeepPartial<Restaurant>);
    const savedOutlet = await this.restaurantRepository.save(outlet);

    return {
      message: 'Outlet created successfully.',
      data: savedOutlet,
    };
  }

  async findAll(
    tenantId: string,
    pagination: PaginationDto = { page: 1, limit: 10 },
    status?: 'active' | 'inactive' | 'all'
  ): Promise<PaginationResponse<Restaurant>> {
    const page = pagination.page || 1;
    const limit = pagination.limit || 10;
    const skip = (page - 1) * limit;

    // Build where clause based on status filter
    const whereClause: any = { tenantId };
    if (status && status !== 'all') {
      whereClause.status = status;
    }

    const [data, total] = await this.restaurantRepository.findAndCount({
      where: whereClause,
      relations: [],
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

  async findOne(id: string): Promise<{ message: string; data: Restaurant }> {
    const outlet = await this.restaurantRepository.findOne({
      where: { id },
      relations: [],
    });

    if (!outlet) {
      throw new NotFoundException('Outlet not found');
    }

    return {
      message: 'Outlet retrieved successfully.',
      data: outlet,
    };
  }

  async update(id: string, updateOutletDto: UpdateOutletDto): Promise<{ isSuccess: boolean; message: string; data: Restaurant }> {
    const existing = await this.restaurantRepository.findOne({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Outlet not found');
    }

    Object.assign(existing, updateOutletDto);
    await this.restaurantRepository.save(existing);

    // Reload the outlet with fresh data and relations
    const refreshedOutlet = await this.restaurantRepository.findOne({
      where: { id },
      relations: ['users'],
    });

    if (!refreshedOutlet) {
      throw new NotFoundException('Outlet not found after update');
    }

    const responseData = {
      ...refreshedOutlet,
    } as any;

    return {
      isSuccess: true,
      message: 'Outlet updated successfully.',
      data: responseData,
    };
  }

  async archive(id: string): Promise<{ message: string }> {
    const outlet = await this.restaurantRepository.findOne({
      where: { id },
      relations: ['users'],
    });

    if (!outlet) {
      throw new NotFoundException('Outlet not found');
    }

    // Soft delete: set status to inactive AND isActive to false
    outlet.status = 'inactive';
    outlet.isActive = false;
    await this.restaurantRepository.save(outlet);

    return {
      message: 'Outlet archived successfully.',
    };
  }

  async unarchive(id: string): Promise<{ message: string; data: Restaurant }> {
    const outlet = await this.restaurantRepository.findOne({
      where: { id },
      relations: ['users'],
    });

    if (!outlet) {
      throw new NotFoundException('Outlet not found');
    }

    if (outlet.status !== 'inactive') {
      throw new BadRequestException('Outlet is not archived. Only archived outlets can be unarchived.');
    }

    outlet.status = 'active';
    outlet.isActive = true;
    const savedOutlet = await this.restaurantRepository.save(outlet);

    return {
      message: 'Outlet unarchived successfully.',
      data: savedOutlet,
    };
  }

  async reactivate(id: string): Promise<{ message: string; data: Restaurant }> {
    return this.unarchive(id);
  }
}
