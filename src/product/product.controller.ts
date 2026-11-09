import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../infrastructure/auth/decorators/current-user.decorator';
import { UserRole } from '../infrastructure/database/entities';
import { resolveStoreId } from '../infrastructure/auth/store-scope';
import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto, ListProductsQueryDto } from './dto/product.dto';

const READ_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER, UserRole.CASHIER];
const WRITE_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER];

@ApiTags('Products')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'List/search products for a store' })
  list(@Query() query: ListProductsQueryDto, @CurrentUser() user: any) {
    return this.productService.findAll(resolveStoreId(query.restaurantId, user), query);
  }

  @Get('departments')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'Departments with product counts' })
  @ApiQuery({ name: 'restaurantId', required: false })
  departments(@Query('restaurantId') restaurantId: string, @CurrentUser() user: any) {
    return this.productService.listDepartments(resolveStoreId(restaurantId, user));
  }

  @Get('barcode/:barcode')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'Till lookup by barcode or SKU' })
  @ApiQuery({ name: 'restaurantId', required: false })
  byBarcode(@Param('barcode') barcode: string, @Query('restaurantId') restaurantId: string, @CurrentUser() user: any) {
    return this.productService.findByBarcode(barcode, resolveStoreId(restaurantId, user));
  }

  @Post('seed-demo')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Load the demo supermarket catalogue into a store' })
  @ApiQuery({ name: 'restaurantId', required: false })
  seed(@Query('restaurantId') restaurantId: string, @CurrentUser() user: any) {
    return this.productService.seedDemoProducts(resolveStoreId(restaurantId, user));
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  @ApiQuery({ name: 'restaurantId', required: false })
  get(@Param('id', ParseUUIDPipe) id: string, @Query('restaurantId') restaurantId: string, @CurrentUser() user: any) {
    return this.productService.findOne(id, resolveStoreId(restaurantId, user));
  }

  @Post()
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Create a product' })
  @ApiQuery({ name: 'restaurantId', required: false })
  create(@Body() dto: CreateProductDto, @Query('restaurantId') restaurantId: string, @CurrentUser() user: any) {
    return this.productService.create(resolveStoreId(restaurantId, user), dto);
  }

  @Patch(':id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Update a product' })
  @ApiQuery({ name: 'restaurantId', required: false })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @Query('restaurantId') restaurantId: string,
    @CurrentUser() user: any,
  ) {
    return this.productService.update(id, resolveStoreId(restaurantId, user), dto);
  }

  @Delete(':id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Archive (deactivate) a product' })
  @ApiQuery({ name: 'restaurantId', required: false })
  archive(@Param('id', ParseUUIDPipe) id: string, @Query('restaurantId') restaurantId: string, @CurrentUser() user: any) {
    return this.productService.archive(id, resolveStoreId(restaurantId, user));
  }
}
