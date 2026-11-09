
import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GenericTypeOrmRepository } from '../../../infrastructure/database/typeorm/generic-typeorm.repository';
import { Restaurant } from './../../../restaurant/restaurant';
import { RestaurantMapper } from './../../../restaurant/restaurant.mapper';
import { IRestaurantRepository } from './interfaces/restaurant-repository.interface';
import { throwApplicationError } from '../../../infrastructure/utilities/exception-instance';
import { Restaurant as RestaurantEntity } from '../../../infrastructure/database/entities/restaurant.entity';
import { PaginationResponse } from '../../../shared/dto/enhanced-pagination.dto';

@Injectable()
export class RestaurantRepository
  extends GenericTypeOrmRepository<Restaurant, RestaurantEntity>
  implements IRestaurantRepository {
  restaurantMapper: RestaurantMapper;
  constructor(
    @InjectRepository(RestaurantEntity) repository: Repository<RestaurantEntity>,
    restaurantMapper: RestaurantMapper
  ) {
    super(repository, restaurantMapper);
    this.restaurantMapper = restaurantMapper;
  }

  async getRestaurant(restaurantId: string): Promise<Restaurant> {
    const restaurantDoc = await this.repository.findOne({
      where: { id: restaurantId },
      relations: ['tenant']
    });
    if (!restaurantDoc) {
      throwApplicationError(HttpStatus.NOT_FOUND, `Restaurant with id ${restaurantId} does not exist`);
    }
    const restaurant: Restaurant = this.restaurantMapper.toDomain(restaurantDoc);
    // Attach entity fields directly to domain object for access in parser
    (restaurant as any).tenantId = restaurantDoc.tenantId;
    (restaurant as any).logo = restaurantDoc.logo;
    (restaurant as any).logoKey = restaurantDoc.logoKey;
    (restaurant as any).banner = restaurantDoc.banner;
    (restaurant as any).bannerKey = restaurantDoc.bannerKey;
    (restaurant as any).address = restaurantDoc.address;
    (restaurant as any).contactEmail = restaurantDoc.contactEmail;
    (restaurant as any).contactPhoneNumber = restaurantDoc.contactPhoneNumber;
    (restaurant as any).openTime = restaurantDoc.openTime;
    (restaurant as any).closeTime = restaurantDoc.closeTime;
    (restaurant as any).openHours = restaurantDoc.openHours;
    (restaurant as any).isActive = restaurantDoc.isActive;
    (restaurant as any).primaryColor = restaurantDoc.primaryColor;
    (restaurant as any).secondaryColor = restaurantDoc.secondaryColor;
    (restaurant as any).tertiaryColor = restaurantDoc.tertiaryColor;
    (restaurant as any).createdAt = restaurantDoc.createdAt;
    (restaurant as any).updatedAt = restaurantDoc.updatedAt;
    return restaurant;
  }

  async getRestaurants(): Promise<Restaurant[]> {
    const restaurantDocs = await this.repository.find({
      relations: ['tenant']
    });
    const restaurants: Restaurant[] = restaurantDocs.map((doc) => {
      const domain = this.restaurantMapper.toDomain(doc);
      // Attach entity fields directly to domain object for access in parser
      (domain as any).tenantId = doc.tenantId;
      (domain as any).logo = doc.logo;
      (domain as any).logoKey = doc.logoKey;
      (domain as any).banner = doc.banner;
      (domain as any).bannerKey = doc.bannerKey;
      (domain as any).address = doc.address;
      (domain as any).contactEmail = doc.contactEmail;
      (domain as any).contactPhoneNumber = doc.contactPhoneNumber;
      (domain as any).openTime = doc.openTime;
      (domain as any).closeTime = doc.closeTime;
      (domain as any).openHours = doc.openHours;
      (domain as any).isActive = doc.isActive;
      (domain as any).primaryColor = doc.primaryColor;
      (domain as any).secondaryColor = doc.secondaryColor;
      (domain as any).tertiaryColor = doc.tertiaryColor;
      (domain as any).createdAt = doc.createdAt;
      (domain as any).updatedAt = doc.updatedAt;
      return domain;
    });
    return restaurants;
  }

  async getRestaurantsWithFilters(filters: any): Promise<PaginationResponse<Restaurant>> {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    // Build query builder for search across multiple fields
    const queryBuilder = this.repository.createQueryBuilder('restaurant')
      .leftJoinAndSelect('restaurant.tenant', 'tenant');

    // Apply search if provided - search in name, address, contactEmail, contactPhoneNumber
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      queryBuilder.where(
        `(restaurant.name ILIKE :search
          OR restaurant.address ->> 'lane' ILIKE :search
          OR restaurant.address ->> 'city' ILIKE :search
          OR restaurant.address ->> 'district' ILIKE :search
          OR restaurant.address ->> 'country' ILIKE :search
          OR restaurant.contactEmail ILIKE :search
          OR restaurant.contactPhoneNumber ILIKE :search)`,
        { search: searchTerm }
      );
    }

    // Apply filters
    if (filters.tenantId) {
      queryBuilder.andWhere('restaurant.tenantId = :tenantId', { tenantId: filters.tenantId });
    }

    // Filter by city
    if (filters.city) {
      queryBuilder.andWhere("restaurant.address ->> 'city' = :city", { city: filters.city });
    }

    // Filter by district
    if (filters.district) {
      queryBuilder.andWhere("restaurant.address ->> 'district' = :district", { district: filters.district });
    }

    // Filter by status
    if (filters.status) {
      queryBuilder.andWhere('restaurant.status = :status', { status: filters.status });
    }

    // Apply sorting
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'DESC';
    const allowedSortFields = ['name', 'address', 'contactEmail', 'contactPhoneNumber', 'createdAt', 'updatedAt'];
    const finalSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    if (finalSortBy === 'address') {
      queryBuilder.orderBy(`restaurant.address ->> 'lane'`, sortOrder as 'ASC' | 'DESC');
    } else {
      queryBuilder.orderBy(`restaurant.${finalSortBy}`, sortOrder as 'ASC' | 'DESC');
    }

    // Get total count
    const total = await queryBuilder.getCount();

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const restaurantDocs = await queryBuilder.getMany();
    const restaurants: Restaurant[] = restaurantDocs.map((doc) => {
      const domain = this.restaurantMapper.toDomain(doc);
      // Attach entity fields directly to domain object for access in parser
      (domain as any).tenantId = doc.tenantId;
      (domain as any).logo = doc.logo;
      (domain as any).address = doc.address;
      (domain as any).contactEmail = doc.contactEmail;
      (domain as any).contactPhoneNumber = doc.contactPhoneNumber;
      (domain as any).openTime = doc.openTime;
      (domain as any).closeTime = doc.closeTime;
      (domain as any).openHours = doc.openHours;
      (domain as any).isActive = doc.isActive;
      return domain;
    });

    return {
      data: restaurants,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

}
