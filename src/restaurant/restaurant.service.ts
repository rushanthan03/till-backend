import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Context } from '../infrastructure/context';
import { TYPES } from './../application/constants/types';
import { Audit } from './../domain/audit/audit';
import { Result } from './../domain/result/result';
import { IContextService } from './../infrastructure/context/context-service.interface';
import { IRestaurantRepository } from './../infrastructure/data_access/repositories/interfaces';
import { throwApplicationError } from './../infrastructure/utilities/exception-instance';
import { CreateRestaurantDTO } from './create-restaurant.dto';
import { Restaurant } from './restaurant';
import { IRestaurantResponseDTO } from './restaurant-response.dto';
import { IRestaurantService } from './restaurant-service.interface';
import { RestaurantMapper } from './restaurant.mapper';
import { RestaurantParser } from './restaurant.parser';
import { EnhancedPaginationDto, PaginationResponse } from '../shared/dto/enhanced-pagination.dto';

@Injectable()
export class RestaurantService implements IRestaurantService {
  private readonly logger = new Logger(RestaurantService.name);
  constructor(
    @Inject(TYPES.IRestaurantRepository)
    private readonly restaurantRepository: IRestaurantRepository,
    private readonly restaurantMapper: RestaurantMapper,
    @Inject(TYPES.IContextService) private readonly contextService: IContextService,
  ) { }

  async createRestaurant(props: CreateRestaurantDTO): Promise<Result<IRestaurantResponseDTO>> {
    const context: Context = this.contextService.getContext();
    const {
      name,
      tenantId,
      address,
      contactEmail,
      contactPhoneNumber,
      logo,
      openTime,
      closeTime,
      openHours,
    } = props;
    const existingRestaurant: Result<Restaurant> = await this.restaurantRepository.findOne({
      where: { name },
    });
    if (existingRestaurant.isSuccess && existingRestaurant.getValue().name === name) {
      throwApplicationError(HttpStatus.BAD_REQUEST, `Restaurant with name ${name} already exists`);
    }

    const audit: Audit = Audit.createInsertContext(context);

    const restaurant: Restaurant = Restaurant.create({
      name,
      email: contactEmail || '',
      phoneNumber: contactPhoneNumber || '',
      audit,
      isActive: props.isActive ?? true,
      opened: false,
      imageUrl: '',
      openingHour: 0,
      closingHour: 24,
      logoUrl: logo,
    }).getValue();

    // Attach new entity fields directly to domain object
    (restaurant as any).tenantId = tenantId;
    (restaurant as any).logo = logo;
    (restaurant as any).address = address || null;
    (restaurant as any).contactEmail = contactEmail;
    (restaurant as any).contactPhoneNumber = contactPhoneNumber;
    (restaurant as any).openTime = openTime;
    (restaurant as any).closeTime = closeTime;
    (restaurant as any).openHours = openHours;
    (restaurant as any).primaryColor = props.primaryColor;
    (restaurant as any).secondaryColor = props.secondaryColor;
    (restaurant as any).tertiaryColor = props.tertiaryColor;

    const restaurantModel = this.restaurantMapper.toPersistence(restaurant);
    restaurantModel.primaryColor = props.primaryColor;
    restaurantModel.secondaryColor = props.secondaryColor;
    restaurantModel.tertiaryColor = props.tertiaryColor;

    const docResult = await this.restaurantRepository.create(restaurantModel);
    if (!docResult.isSuccess) {
      throwApplicationError(HttpStatus.SERVICE_UNAVAILABLE, 'Error while creating restaurant');
    }
    const newRestaurant = docResult.getValue();

    //await this.assignDefaultSubscription(newRestaurant.id);
    const restaurantWithDetails = await this.restaurantRepository.getRestaurant(newRestaurant.id);

    return Result.ok(
      RestaurantParser.createRestaurantResponse(restaurantWithDetails),
      'Restaurant created successfully',
    );
  }

  async updateRestaurant(id: string, props: any): Promise<Result<IRestaurantResponseDTO>> {
    try {
      console.log('[RestaurantService] Updating restaurant:', id, 'with props:', JSON.stringify(props));

      // Build update object with only the fields that are provided
      const updateData: any = {};

      if (props.name !== undefined) updateData.name = props.name;
      if (props.logo !== undefined) updateData.logo = props.logo;
      if (props.address !== undefined) updateData.address = props.address;
      if (props.contactEmail !== undefined) updateData.contactEmail = props.contactEmail;
      if (props.contactPhoneNumber !== undefined) updateData.contactPhoneNumber = props.contactPhoneNumber;
      if (props.openTime !== undefined) updateData.openTime = props.openTime;
      if (props.closeTime !== undefined) updateData.closeTime = props.closeTime;
      if (props.openHours !== undefined) updateData.openHours = props.openHours;
      if (props.isActive !== undefined) updateData.isActive = props.isActive;
      if (props.primaryColor !== undefined) updateData.primaryColor = props.primaryColor;
      if (props.secondaryColor !== undefined) updateData.secondaryColor = props.secondaryColor;
      if (props.tertiaryColor !== undefined) updateData.tertiaryColor = props.tertiaryColor;

      // Update timestamp
      updateData.updatedAt = new Date();

      // First fetch the existing restaurant entity
      const existingRestaurant = await (this.restaurantRepository as any).repository.findOne({
        where: { id },
        relations: ['tenant']
      });

      if (!existingRestaurant) {
        return Result.fail('Restaurant not found', HttpStatus.NOT_FOUND);
      }

      // Merge the update data into the existing entity
      const mergedRestaurant = (this.restaurantRepository as any).repository.merge(existingRestaurant, updateData);

      // Save the merged entity (this preserves relations)
      await (this.restaurantRepository as any).repository.save(mergedRestaurant);

      // Fetch the updated restaurant using the repository method
      const updatedRestaurant = await this.restaurantRepository.getRestaurant(id);


      const restaurantResponse = RestaurantParser.createRestaurantResponse(updatedRestaurant);


      return Result.ok(
        restaurantResponse,
        'Restaurant updated successfully',
      );
    } catch (error) {
      console.error('[RestaurantService] Error updating restaurant:', error);
      console.error('[RestaurantService] Error stack:', error.stack);
      return Result.fail('Failed to update restaurant', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async deleteRestaurant(id: string): Promise<Result<boolean>> {
    const result = await this.restaurantRepository.deleteOne({ id });
    return Result.ok(result, 'Restaurant deleted successfully');
  }

  async getRestaurants(): Promise<Result<IRestaurantResponseDTO[]>> {
    // Note: validateContext() removed - this endpoint uses AccessAuthGuard which validates JWT tokens
    // SingleClient context validation is not needed for regular authenticated users
    const restaurants: Restaurant[] = await this.restaurantRepository.getRestaurants();
    const restaurantsResponse = RestaurantParser.createRestaurantsParser(restaurants);

    const enrichedResponse = restaurantsResponse;

    return Result.ok(enrichedResponse, 'Restaurants retrieved successfully');
  }

  async getRestaurantsWithFilters(filters: EnhancedPaginationDto): Promise<Result<PaginationResponse<IRestaurantResponseDTO>>> {
    // Note: validateContext() removed - this endpoint uses AccessAuthGuard which validates JWT tokens
    // SingleClient context validation is not needed for regular authenticated users
    const result = await this.restaurantRepository.getRestaurantsWithFilters(filters);
    const restaurantsResponse = result.data.map((restaurant) => RestaurantParser.createRestaurantResponse(restaurant));

    const enrichedResponse = restaurantsResponse;

    return Result.ok(
      {
        data: enrichedResponse,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
      'Restaurants retrieved successfully',
    );
  }

  async getRestaurantById(id: string): Promise<Result<IRestaurantResponseDTO>> {
    const result = await this.restaurantRepository.findOne({ where: { id } });
    if (!result.isSuccess) {
      throwApplicationError(HttpStatus.NOT_FOUND, 'Restaurant not found');
    }
    const restaurantId: string = result.getValue().id;
    const restaurantWithDetails: Restaurant = await this.restaurantRepository.getRestaurant(restaurantId);
    const restaurantResponse = RestaurantParser.createRestaurantResponse(restaurantWithDetails);

    return Result.ok(
      restaurantResponse,
      'Restaurant retrieved successfully',
    );
  }

  async toggleRestaurantStatus(id: string): Promise<Result<{ message: string }>> {
    const restaurantResult = await this.restaurantRepository.findOne({ where: { id } });
    if (!restaurantResult.isSuccess) {
      throwApplicationError(HttpStatus.NOT_FOUND, 'Restaurant is not available');
    }

    const restaurant = restaurantResult.getValue();
    const updateResult = await this.restaurantRepository.updateOne(
      { id },
      { isActive: !restaurant.isActive } as any,
    );

    if (!updateResult.isSuccess) {
      throwApplicationError(HttpStatus.INTERNAL_SERVER_ERROR, 'Unable to toggle restaurant status');
    }

    return Result.ok({ message: 'Restaurant status changed successfully.' }, 'Restaurant status toggled successfully');
  }
}
