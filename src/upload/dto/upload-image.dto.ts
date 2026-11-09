import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadImageDto {
    @ApiProperty({ required: false })
    @IsString()
    @IsOptional()
    restaurantId?: string;
}

export class MultipleUploadDto extends UploadImageDto {
    @ApiProperty({ enum: ['restaurants', 'menus', 'categories', 'users', 'transactions'] })
    @IsString()
    folder: 'restaurants' | 'menus' | 'categories' | 'users' | 'transactions';
}
