import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiCreatedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { OutletService } from './outlet.service';
import { CreateOutletDto, UpdateOutletDto } from './dto';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
import { Public } from '../infrastructure/auth/decorators/public.decorator';
import { CurrentUser } from '../infrastructure/auth/decorators/current-user.decorator';
import { UserRole, Restaurant } from '../infrastructure/database/entities';
import { PaginationDto } from '../shared/dto/pagination.dto';

@ApiTags('Outlets')
@ApiBearerAuth()
@Controller('tenants/:tenantId/outlets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutletController {
  constructor(private readonly outletService: OutletService) { }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Create a new outlet for a tenant' })
  @ApiParam({ name: 'tenantId', description: 'Tenant identifier', format: 'uuid' })
  @ApiBody({
    type: CreateOutletDto,
    examples: {
      default: {
        summary: 'Example outlet creation payload',
        value: {
          name: 'Downtown Dining',
          address: {
            lane: '42 Elm Street',
            city: 'New York',
            district: 'Manhattan',
            country: 'USA',
          },
          logo: 'https://cdn.example.com/logo.png',
          contactEmail: 'contact@downtowndining.com',
          contactPhoneNumber: '+15551234567',
          openTime: '09:00',
          closeTime: '22:00',
          openHours: {
            Monday: '09:00-21:00',
            Friday: '09:00-23:00',
          },
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Outlet created successfully.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Outlet created successfully.' },
        data: { $ref: getSchemaPath(Restaurant) },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'User authentication required.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  create(@Param('tenantId') tenantId: string, @Body() createOutletDto: CreateOutletDto) {
    return this.outletService.create(tenantId, createOutletDto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'List outlets for a tenant with pagination' })
  @ApiParam({ name: 'tenantId', description: 'Tenant identifier', format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size for pagination' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['active', 'inactive', 'all'],
    description: 'Filter by status (active, inactive, or all). Default: all'
  })
  @ApiOkResponse({
    description: 'Paginated list of outlets.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(Restaurant) },
        },
        total: { type: 'number', example: 25 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
        totalPages: { type: 'number', example: 3 },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'User authentication required.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  findAll(
    @Param('tenantId') tenantId: string,
    @Query() pagination: PaginationDto,
    @Query('status') status?: 'active' | 'inactive' | 'all'
  ) {
    return this.outletService.findAll(tenantId, pagination, status);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Update an existing outlet' })
  @ApiParam({ name: 'tenantId', description: 'Tenant identifier', format: 'uuid' })
  @ApiParam({ name: 'id', description: 'Outlet identifier', format: 'uuid' })
  @ApiBody({
    type: UpdateOutletDto,
    examples: {
      default: {
        summary: 'Example outlet update payload',
        value: {
          name: 'Downtown Dining - East',
          address: {
            lane: '105 East Ave',
            city: 'New York',
            district: 'Brooklyn',
            country: 'USA',
          },
          contactEmail: 'hello@downtowndining.com',
          contactPhoneNumber: '+15557654321',
          openTime: '08:30',
          closeTime: '23:00',
          openHours: {
            Monday: '08:30-22:30',
            Friday: '08:30-23:30',
          },
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Outlet updated successfully.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Outlet updated successfully.' },
        data: { $ref: getSchemaPath(Restaurant) },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'User authentication required.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  update(
    @Param('id') id: string,
    @Body() updateOutletDto: UpdateOutletDto,
    @CurrentUser() user?: any,
  ) {
    return this.outletService.update(id, updateOutletDto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Archive an outlet' })
  @ApiParam({ name: 'tenantId', description: 'Tenant identifier', format: 'uuid' })
  @ApiParam({ name: 'id', description: 'Outlet identifier', format: 'uuid' })
  @ApiOkResponse({
    description: 'Outlet archived successfully.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Outlet archived successfully.' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'User authentication required.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  remove(@Param('id') id: string) {
    return this.outletService.archive(id);
  }

  @Post(':id/unarchive')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Unarchive an outlet' })
  @ApiParam({ name: 'tenantId', description: 'Tenant identifier', format: 'uuid' })
  @ApiParam({ name: 'id', description: 'Outlet identifier', format: 'uuid' })
  @ApiOkResponse({
    description: 'Outlet unarchived successfully.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Outlet unarchived successfully.' },
        data: { $ref: getSchemaPath(Restaurant) },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'User authentication required.' })
  @ApiForbiddenResponse({ description: 'Only super admins can access this resource.' })
  unarchive(@Param('id') id: string) {
    return this.outletService.unarchive(id);
  }

  @Post(':id/reactivate')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reactivate an outlet (alias for unarchive)' })
  @ApiParam({ name: 'tenantId', description: 'Tenant identifier', format: 'uuid' })
  @ApiParam({ name: 'id', description: 'Outlet identifier', format: 'uuid' })
  @ApiOkResponse({
    description: 'Outlet reactivated successfully.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Outlet unarchived successfully.' },
        data: { $ref: getSchemaPath(Restaurant) },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'User authentication required.' })
  @ApiForbiddenResponse({ description: 'Only super admins can access this resource.' })
  reactivate(@Param('id') id: string) {
    return this.outletService.reactivate(id);
  }
}

@ApiTags('Outlets')
@ApiBearerAuth()
@Controller('outlets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutletDirectController {
  constructor(private readonly outletService: OutletService) { }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Retrieve a single outlet by identifier' })
  @ApiParam({ name: 'id', description: 'Outlet identifier', format: 'uuid' })
  @ApiOkResponse({
    description: 'Outlet details.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Outlet retrieved successfully.' },
        data: { $ref: getSchemaPath(Restaurant) },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'User authentication required.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  findOne(@Param('id') id: string) {
    return this.outletService.findOne(id);
  }

}
