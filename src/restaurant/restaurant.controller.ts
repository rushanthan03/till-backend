import { Body, Controller, Get, Inject, Param, Post, UseGuards, UnauthorizedException, Query, Patch, Put } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { GetCurrentUserId, AccessAuthGuard } from './../infrastructure';
import { TYPES } from './../application/constants/types';
import { Result } from './../domain/result/result';
import { CreateRestaurantDTO } from './create-restaurant.dto';
import { UpdateRestaurantDTO } from './update-restaurant.dto';
import { IRestaurantResponseDTO } from './restaurant-response.dto';
import { IRestaurantService } from './restaurant-service.interface';
import { EnhancedPaginationDto } from '../shared/dto/enhanced-pagination.dto';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
import { UserRole } from '../infrastructure/database/entities';


@ApiTags('Restaurants')
@Controller('restaurants')
export class RestaurantsController {
  constructor(
    @Inject(TYPES.IRestaurantService)
    private readonly restaurantService: IRestaurantService,
  ) { }

  @Post()
  @UseGuards(AccessAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new restaurant' })
  @ApiBody({ type: CreateRestaurantDTO })
  @ApiOkResponse({ description: 'Restaurant created successfully.' })
  @ApiUnauthorizedResponse({ description: 'User authentication required.' })
  async createRestaurant(
    @Body() request: CreateRestaurantDTO,
    @GetCurrentUserId() userId: string,
  ): Promise<Result<IRestaurantResponseDTO>> {
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token. Please ensure you are authenticated.');
    }
    return this.restaurantService.createRestaurant(request);
  }

  @Get()
  @UseGuards(AccessAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve restaurants with optional filters' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term applied across fields' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Field to sort by' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'], description: 'Sort order' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number for pagination' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size for pagination' })
  @ApiQuery({ name: 'tenantId', required: false, description: 'Filter by tenant identifier' })
  @ApiQuery({ name: 'city', required: false, description: 'Filter by city' })
  @ApiQuery({ name: 'district', required: false, description: 'Filter by district' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive'], description: 'Filter by status' })
  @ApiQuery({ name: 'isOverLimit', required: false, type: Boolean, description: 'Filter restaurants that exceeded their order limit' })
  @ApiQuery({ name: 'minWalletBalance', required: false, type: Number, description: 'Filter by minimum wallet balance' })
  @ApiQuery({ name: 'maxWalletBalance', required: false, type: Number, description: 'Filter by maximum wallet balance' })
  @ApiOkResponse({ description: 'List of restaurants.' })
  async getRestaurants(@Query() filters: EnhancedPaginationDto): Promise<Result<IRestaurantResponseDTO[] | any>> {
    // If any filter parameters are provided, use the enhanced endpoint
    if (filters.search || filters.sortBy || filters.sortOrder || filters.page || filters.limit ||
      filters.tenantId || filters.city || filters.district || filters.status ||
      filters.planId || filters.planCode || filters.isOverLimit !== undefined ||
      filters.minWalletBalance !== undefined || filters.maxWalletBalance !== undefined) {
      return this.restaurantService.getRestaurantsWithFilters(filters);
    }
    // Otherwise, use the simple endpoint for backward compatibility
    return this.restaurantService.getRestaurants();
  }

  @Get('/:id')
  @UseGuards(AccessAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve a restaurant by id' })
  @ApiParam({ name: 'id', description: 'Restaurant identifier', format: 'uuid' })
  @ApiOkResponse({ description: 'Restaurant details.' })
  async getRestaurantById(@Param('id') restaurantId: string): Promise<Result<IRestaurantResponseDTO>> {
    return this.restaurantService.getRestaurantById(restaurantId);
  }

  @Patch('/:id/status/toggle')
  @UseGuards(AccessAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle restaurant status between active and inactive' })
  @ApiParam({ name: 'id', description: 'Restaurant identifier', format: 'uuid' })
  @ApiOkResponse({
    description: 'Restaurant status toggled successfully.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Restaurant status changed successfully.' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'User authentication required.' })
  async toggleRestaurantStatus(@Param('id') restaurantId: string): Promise<Result<{ message: string }>> {
    return this.restaurantService.toggleRestaurantStatus(restaurantId);
  }

  @Put('/:id')
  @Patch('/:id')
  @UseGuards(AccessAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update restaurant details' })
  @ApiParam({ name: 'id', description: 'Restaurant identifier', format: 'uuid' })
  @ApiBody({ type: UpdateRestaurantDTO })
  @ApiOkResponse({ description: 'Restaurant updated successfully.' })
  @ApiUnauthorizedResponse({ description: 'User authentication required.' })
  async updateRestaurant(
    @Param('id') restaurantId: string,
    @Body() request: UpdateRestaurantDTO,
  ): Promise<Result<IRestaurantResponseDTO>> {
    return this.restaurantService.updateRestaurant(restaurantId, request);
  }
}
