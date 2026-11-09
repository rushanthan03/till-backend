import {
    Controller,
    Post,
    Delete,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    UploadedFiles,
    Body,
    Param,
    BadRequestException,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiConsumes,
    ApiOperation,
    ApiTags,
    ApiBody,
    ApiOkResponse,
    ApiBadRequestResponse,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { S3Service } from '../shared/services/s3.service';
import { JwtAuthGuard } from '../infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../infrastructure/auth/guards/roles.guard';
import { Roles } from '../infrastructure/auth/decorators/roles.decorator';
import { CurrentUser } from '../infrastructure/auth/decorators/current-user.decorator';
import { UserRole } from '../infrastructure/database/entities';
import { UploadImageDto, MultipleUploadDto } from './dto/upload-image.dto';

@ApiTags('Image Upload')
@ApiBearerAuth()
@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImageUploadController {
    constructor(private readonly s3Service: S3Service) { }

    @Post('restaurant')
    @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN)
    @UseInterceptors(FileInterceptor('image'))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({
        summary: 'Upload Restaurant Image',
        description: 'Upload a restaurant logo or banner image to S3',
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                image: {
                    type: 'string',
                    format: 'binary',
                    description: 'Restaurant image file (JPG, PNG, WEBP, max 5MB)',
                },
                restaurantId: {
                    type: 'string',
                    description: 'Restaurant ID (optional - if not provided, image will be uploaded to a temporary location)',
                },
            },
            required: ['image'],
        },
    })
    @ApiOkResponse({
        description: 'Image uploaded successfully',
        schema: {
            type: 'object',
            properties: {
                key: { type: 'string' },
                url: { type: 'string' },
                publicUrl: { type: 'string' },
                bucket: { type: 'string' },
                size: { type: 'number' },
                contentType: { type: 'string' },
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid file or missing parameters' })
    @ApiUnauthorizedResponse({ description: 'User authentication required' })
    async uploadRestaurantImage(
        @UploadedFile() file: Express.Multer.File,
        @Body() uploadDto: UploadImageDto,
        @CurrentUser() user: any,
    ) {
        // restaurantId is now optional - can be undefined for new restaurants
        return this.s3Service.uploadImage(file, 'restaurants', uploadDto.restaurantId);
    }

    @Post('multiple')
    @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER)
    @UseInterceptors(FilesInterceptor('images', 10))
    @ApiConsumes('multipart/form-data')
    @ApiOperation({
        summary: 'Upload Multiple Images',
        description: 'Upload multiple images at once (max 10)',
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                images: {
                    type: 'array',
                    items: {
                        type: 'string',
                        format: 'binary',
                    },
                    description: 'Image files (JPG, PNG, WEBP, max 5MB each)',
                },
                folder: {
                    type: 'string',
                    enum: ['restaurants', 'menus', 'categories'],
                    description: 'Target folder',
                },
                restaurantId: {
                    type: 'string',
                    description: 'Restaurant ID',
                },
            },
            required: ['images', 'folder', 'restaurantId'],
        },
    })
    @ApiOkResponse({ description: 'Images uploaded successfully' })
    @ApiBadRequestResponse({ description: 'Invalid files or missing parameters' })
    async uploadMultipleImages(
        @UploadedFiles() files: Express.Multer.File[],
        @Body() multipleDto: MultipleUploadDto,
        @CurrentUser() user: any,
    ) {
        const { restaurantId, folder } = multipleDto;

        if (!restaurantId) {
            throw new BadRequestException('Restaurant ID is required');
        }

        if (!folder) {
            throw new BadRequestException('Folder is required');
        }

        if (!files || files.length === 0) {
            throw new BadRequestException('No files provided');
        }

        return this.s3Service.uploadMultipleImages(files, folder, restaurantId);
    }

    @Delete(':key')
    @Roles(UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.MANAGER)
    @ApiOperation({
        summary: 'Delete Image',
        description: 'Delete an image from S3 by its key',
    })
    @ApiOkResponse({ description: 'Image deleted successfully' })
    @ApiBadRequestResponse({ description: 'Invalid key' })
    async deleteImage(@Param('key') key: string, @CurrentUser() user: any) {
        // Decode the key (in case it's URL encoded)
        const decodedKey = decodeURIComponent(key);
        await this.s3Service.deleteImage(decodedKey);
        return { message: 'Image deleted successfully', key: decodedKey };
    }

}
