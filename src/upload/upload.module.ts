import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ImageUploadController } from './image-upload.controller';
import { S3Service } from '../shared/services/s3.service';

@Module({
    imports: [ConfigModule],
    controllers: [ImageUploadController],
    providers: [S3Service],
    exports: [S3Service],
})
export class UploadModule { }
