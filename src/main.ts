import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createDataSource, runSeeders } from './infrastructure/database/database.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.setGlobalPrefix('api', {
    exclude: ['/', 'health', 'v1/(.*)', 'invoice/(.*)', 'receipt/(.*)', 'invoices/view/(.*)', 'v1/invoices/view/(.*)'],
  });
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      return callback(null, true); // Allow any requesting origin with full credentials support
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'x-restaurant-id',
      'x-tenant-id',
      'x-client-platform',
    ],
    exposedHeaders: ['Content-Disposition'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('DineFlow Till API')
    .setDescription('API documentation for the DineFlow Till backend services (products, sales, refunds, till sessions)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Automatic startup migrations and seeders are DISABLED to prevent unexpected schema changes on boot.
  // Run migrations manually using: npm run migration:run
  /*
  try {
    const dataSource = createDataSource(configService);
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }
    console.log('Checking and running database migrations...');
    await dataSource.runMigrations();
    console.log('Database migrations completed successfully.');

    await runSeeders(dataSource);
  } catch (error) {
    console.error('Error running database migrations/seeders:', error);
  }
  */

  const port = configService.get<number>('PORT', 4001);
  const serverUrl = configService.get<string>('SERVER_URL', `http://localhost:${port}`);
  
  await app.listen(port);
  
  console.log(`Application is running on: ${serverUrl}/api`);
  console.log(`Swagger documentation: ${serverUrl}/api/docs`);
}
bootstrap();
