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
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
import {
  UserRole,
  TenantStatus,
  Tenant,
  TenantType,
  SubscriptionPlan,
} from '../infrastructure/database/entities';
import { PaginationDto } from '../shared/dto/pagination.dto';
import { EnhancedPaginationDto, SortOrder } from '../shared/dto/enhanced-pagination.dto';

@ApiTags('Tenants')
@ApiBearerAuth()
@ApiExtraModels(Tenant)
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) { }

  @Get('search')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Search tenants (searches name and subdomain)' })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Search keyword' })
  @ApiOkResponse({
    description: 'List of tenants with minimal data (id, tenantName).',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantName: { type: 'string' },
        },
      },
    },
  })
  async searchTenants(@Query('q') query?: string) {
    try {
      const result = await this.tenantService.searchTenants(query);
      return result;
    } catch (error) {
      console.error('[TenantController] searchTenants error:', error);
      throw error;
    }
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new tenant' })
  @ApiBody({ type: CreateTenantDto })
  @ApiCreatedResponse({ description: 'Tenant created successfully.', type: Tenant })
  @ApiUnauthorizedResponse({ description: 'User authentication required.' })
  @ApiForbiddenResponse({ description: 'Only super admins can access this resource.' })
  create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantService.create(createTenantDto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List tenants with pagination, search, and filtering options' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size for pagination' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search keyword applied to name, subdomain, contact email, or description' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Field to sort by. Allowed values: name, subdomain, status, type, subscriptionPlan, createdAt, updatedAt' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: SortOrder, description: 'Sort direction' })
  @ApiQuery({ name: 'status', required: false, enum: TenantStatus, description: 'Filter by tenant status' })
  @ApiQuery({ name: 'type', required: false, enum: TenantType, description: 'Filter by tenant type (STORE)' })
  @ApiQuery({ name: 'subscriptionPlan', required: false, enum: SubscriptionPlan, description: 'Filter by subscription plan' })
  @ApiQuery({ name: 'city', required: false, type: String, description: 'Filter by city' })
  @ApiQuery({ name: 'district', required: false, type: String, description: 'Filter by district' })
  @ApiOkResponse({
    description: 'Paginated list of tenants.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(Tenant) },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'User authentication required.' })
  @ApiForbiddenResponse({ description: 'Only super admins can access this resource.' })
  findAll(@Query() filters: EnhancedPaginationDto | PaginationDto) {
    // If any enhanced filter parameters are provided, use the enhanced endpoint
    if ((filters as EnhancedPaginationDto).search || (filters as EnhancedPaginationDto).sortBy || (filters as EnhancedPaginationDto).sortOrder || (filters as EnhancedPaginationDto).status || (filters as EnhancedPaginationDto).type || (filters as EnhancedPaginationDto).subscriptionPlan || (filters as EnhancedPaginationDto).city || (filters as EnhancedPaginationDto).district) {
      return this.tenantService.findAllWithFilters(filters as EnhancedPaginationDto);
    }
    // Otherwise, use the simple endpoint for backward compatibility
    return this.tenantService.findAll(filters as PaginationDto);
  }

  @Get('list')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Retrieve a simplified tenant list' })
  findAllSimple(@Query('search') search?: string) {
    return this.tenantService.findAllSimple(search);
  }



  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Retrieve a tenant by its identifier' })
  @ApiParam({ name: 'id', description: 'Tenant identifier', format: 'uuid' })
  @ApiOkResponse({ description: 'Tenant details.', type: Tenant })
  @ApiUnauthorizedResponse({ description: 'User authentication required.' })
  @ApiForbiddenResponse({ description: 'Only super admins can access this resource.' })
  findOne(@Param('id') id: string) {
    return this.tenantService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an existing tenant' })
  @ApiParam({ name: 'id', description: 'Tenant identifier', format: 'uuid' })
  @ApiBody({ type: UpdateTenantDto })
  @ApiOkResponse({ description: 'Tenant updated successfully.', type: Tenant })
  @ApiUnauthorizedResponse({ description: 'User authentication required.' })
  @ApiForbiddenResponse({ description: 'Only super admins can access this resource.' })
  update(@Param('id') id: string, @Body() updateTenantDto: UpdateTenantDto) {
    return this.tenantService.update(id, updateTenantDto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Archive a tenant (soft delete - sets status to INACTIVE)' })
  @ApiParam({ name: 'id', description: 'Tenant identifier', format: 'uuid' })
  @ApiOkResponse({
    description: 'Tenant archived successfully.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Tenant archived successfully' }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'User authentication required.' })
  @ApiForbiddenResponse({ description: 'Only super admins can access this resource.' })
  remove(@Param('id') id: string) {
    return this.tenantService.archive(id);
  }

  @Post(':id/unarchive')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Unarchive a tenant' })
  @ApiParam({ name: 'id', description: 'Tenant identifier', format: 'uuid' })
  @ApiOkResponse({
    description: 'Tenant unarchived successfully.',
    type: Tenant
  })
  @ApiUnauthorizedResponse({ description: 'User authentication required.' })
  @ApiForbiddenResponse({ description: 'Only super admins can access this resource.' })
  unarchive(@Param('id') id: string) {
    return this.tenantService.unarchive(id);
  }

  @Post(':id/reactivate')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reactivate a tenant (alias for unarchive)' })
  @ApiParam({ name: 'id', description: 'Tenant identifier', format: 'uuid' })
  @ApiOkResponse({
    description: 'Tenant reactivated successfully.',
    type: Tenant
  })
  @ApiUnauthorizedResponse({ description: 'User authentication required.' })
  @ApiForbiddenResponse({ description: 'Only super admins can access this resource.' })
  reactivate(@Param('id') id: string) {
    return this.tenantService.reactivate(id);
  }

  @Patch(':id/status/toggle')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Toggle tenant status between active and inactive' })
  @ApiParam({ name: 'id', description: 'Tenant identifier', format: 'uuid' })
  @ApiOkResponse({
    description: 'Tenant status toggled successfully.',
    type: Tenant
  })
  @ApiUnauthorizedResponse({ description: 'User authentication required.' })
  @ApiForbiddenResponse({ description: 'Only super admins can access this resource.' })
  toggleStatus(@Param('id') id: string) {
    return this.tenantService.toggleStatus(id);
  }
}
