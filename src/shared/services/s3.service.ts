import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { S3, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as path from 'path';

export interface UploadResult {
    key: string;
    url: string;
    publicUrl: string;
    bucket: string;
    size: number;
    contentType: string;
}

@Injectable()
export class S3Service {
    private readonly logger = new Logger(S3Service.name);
    private readonly s3Client: S3;
    private readonly bucketName: string;
    private readonly region: string;
    private readonly endpoint: string;

    constructor(private configService: ConfigService) {
        this.bucketName = this.configService.get<string>('OBJECT_BUCKET') || 'dinesoon';
        this.region = this.configService.get<string>('OBJECT_REGION') || 'us-east-1';
        this.endpoint = this.configService.get<string>('OBJECT_ENDPOINT') || 'https://nyc3.digitaloceanspaces.com';

        const accessKeyId = this.configService.get<string>('OBJECT_KEY_ID');
        const secretAccessKey = this.configService.get<string>('OBJECT_ACCESS_KEY');

        if (!accessKeyId || !secretAccessKey) {
            this.logger.warn('DigitalOcean Spaces not configured. Set OBJECT_KEY_ID and OBJECT_SECRET in .env');
        }

        this.s3Client = new S3({
            forcePathStyle: false,
            endpoint: `https://${this.region}.digitaloceanspaces.com`, // Use regional endpoint for API calls
            region: this.region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });

        this.logger.log(`Storage initialized: ${this.bucketName} @ ${this.endpoint}`);
    }

    /**
     * Upload image with public access
     */
    async uploadImage(
        file: Express.Multer.File,
        folder: 'restaurants' | 'menus' | 'categories' | 'users' | 'transactions',
        restaurantId?: string,
    ): Promise<UploadResult> {
        try {
            this.validateImageFile(file);
            const fileName = this.generateSecureFileName(file.originalname);
            const key = this.buildKey(folder, fileName, restaurantId);

            await this.s3Client.send(new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
                CacheControl: 'max-age=31536000', // 1 year cache
                ACL: 'public-read',
                Metadata: {
                    originalName: file.originalname,
                    uploadedAt: new Date().toISOString(),
                    restaurantId: restaurantId || 'system',
                },
            }));

            const publicUrl = this.getPublicUrl(key);
            this.logger.log(`Uploaded: ${key}`);

            return {
                key,
                url: publicUrl,
                publicUrl,
                bucket: this.bucketName,
                size: file.size,
                contentType: file.mimetype,
            };
        } catch (error) {
            this.logger.error(`Upload failed: ${error.message}`, error.stack);
            throw new BadRequestException(`Upload failed: ${error.message}`);
        }
    }

    /**
     * Upload multiple images
     */
    async uploadMultipleImages(
        files: Express.Multer.File[],
        folder: 'restaurants' | 'menus' | 'categories' | 'users' | 'transactions',
        restaurantId?: string,
    ): Promise<UploadResult[]> {
        return Promise.all(files.map(file => this.uploadImage(file, folder, restaurantId)));
    }

    /**
     * Delete image
     */
    async deleteImage(key: string): Promise<void> {
        try {
            await this.s3Client.send(new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            }));
            this.logger.log(`Deleted: ${key}`);
        } catch (error) {
            this.logger.error(`Delete failed: ${error.message}`, error.stack);
            throw new BadRequestException(`Delete failed: ${error.message}`);
        }
    }

    /**
     * Delete multiple images
     */
    async deleteMultipleImages(keys: string[]): Promise<void> {
        await Promise.all(keys.map(key => this.deleteImage(key)));
    }

    /**
     * Replace image (upload new, delete old)
     */
    async replaceImage(
        oldKey: string | null,
        newFile: Express.Multer.File,
        folder: 'restaurants' | 'menus' | 'categories' | 'users' | 'transactions',
        restaurantId?: string,
    ): Promise<UploadResult> {
        const uploadResult = await this.uploadImage(newFile, folder, restaurantId);
        if (oldKey) {
            try {
                await this.deleteImage(oldKey);
            } catch (error) {
                this.logger.warn(`Failed to delete old image: ${oldKey}`);
            }
        }
        return uploadResult;
    }

    /**
     * Get public URL
     */
    getPublicUrl(key: string): string {
        // This format is GUARANTEED to work immediately:
        // https://bucket-name.region.digitaloceanspaces.com/key
        return `https://${this.bucketName}.${this.region}.digitaloceanspaces.com/${key}`;

        /* 
        NOTE: If you want to use 'https://object.dinesoon.com/key', 
        you MUST go to DO Dashboard -> Spaces -> Settings -> Custom Domains 
        and add 'object.dinesoon.com'. 
        Otherwise, DO will return 'NoSuchBucket'.
        */
    }

    /**
     * Get signed URL (for temporary access if needed)
     */
    async getSignedUrl(key: string, expiresIn: number = 259200): Promise<string> {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });
            return await getSignedUrl(this.s3Client, command, { expiresIn });
        } catch (error) {
            this.logger.error(`Signed URL failed: ${error.message}`, error.stack);
            throw new BadRequestException(`Signed URL failed: ${error.message}`);
        }
    }

    /**
     * Extract key from URL
     */
    extractKeyFromUrl(url: string): string | null {
        try {
            // Check for standard DO format
            if (url.includes('digitaloceanspaces.com')) {
                return url.split('.digitaloceanspaces.com/')[1]?.split('?')[0];
            }

            // Check for custom domain format
            const cleanEndpoint = this.endpoint.replace(/^https?:\/\//, '');
            if (url.includes(cleanEndpoint)) {
                let pathAfterDomain = url.split(`${cleanEndpoint}/`)[1]?.split('?')[0];
                if (pathAfterDomain?.startsWith(`${this.bucketName}/`)) {
                    pathAfterDomain = pathAfterDomain.replace(`${this.bucketName}/`, '');
                }
                return pathAfterDomain;
            }
            return url;
        } catch (error) {
            this.logger.warn(`Failed to extract key from URL: ${url}`);
            return null;
        }
    }

    /**
     * Upload PDF (for invoices)
     */
    async uploadPdf(
        buffer: Buffer,
        fileName: string,
        restaurantId?: string,
    ): Promise<UploadResult> {
        try {
            const key = this.buildKey('invoices', fileName, restaurantId);

            await this.s3Client.send(new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: buffer,
                ContentType: 'application/pdf',
                CacheControl: 'max-age=5184000',
                ACL: 'public-read',
                Metadata: {
                    uploadedAt: new Date().toISOString(),
                    restaurantId: restaurantId || 'system',
                },
            }));

            const publicUrl = this.getPublicUrl(key);
            this.logger.log(`PDF uploaded: ${key}`);

            return {
                key,
                url: publicUrl,
                publicUrl,
                bucket: this.bucketName,
                size: buffer.length,
                contentType: 'application/pdf',
            };
        } catch (error) {
            this.logger.error(`PDF upload failed: ${error.message}`, error.stack);
            throw new BadRequestException(`PDF upload failed: ${error.message}`);
        }
    }

    /**
     * Validate image file
     */
    private validateImageFile(file: Express.Multer.File): void {
        if (!file) {
            throw new BadRequestException('No file provided');
        }

        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            throw new BadRequestException('File size exceeds 5MB limit');
        }

        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new BadRequestException(`Invalid file type. Allowed: ${allowedMimeTypes.join(', ')}`);
        }

        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
        const fileExtension = path.extname(file.originalname).toLowerCase();
        if (!allowedExtensions.includes(fileExtension)) {
            throw new BadRequestException(`Invalid extension. Allowed: ${allowedExtensions.join(', ')}`);
        }
    }

    /**
     * Generate secure filename
     */
    private generateSecureFileName(originalName: string): string {
        const extension = path.extname(originalName).toLowerCase();
        const randomName = crypto.randomBytes(16).toString('hex');
        const timestamp = Date.now();
        return `${timestamp}-${randomName}${extension}`;
    }

    /**
     * Build storage key with folder structure
     */
    private buildKey(folder: string, fileName: string, restaurantId?: string): string {
        return restaurantId ? `${folder}/${restaurantId}/${fileName}` : `${folder}/${fileName}`;
    }
}
