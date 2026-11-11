import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createDataSource, runSeeders } from './infrastructure/database/database.config';
import helmet from 'helmet';
import { config as loadEnv } from 'dotenv';
import { checkProductionConfig, isOriginAllowed } from './infrastructure/config/production-checks';

async function bootstrap() {
  // Read the same env files the app uses (the first file wins), so the safety check below sees the real settings.
  loadEnv({ path: ['.env', '.env.local', '.env.production'], quiet: true });
  const production = process.env.NODE_ENV === 'production';

  // Refuse to start a live server with placeholder secrets or a wide-open configuration.
  // This runs before anything connects to the database, so a bad config is reported straight away.
  if (production) {
    const { errors, warnings } = checkProductionConfig(process.env);
    warnings.forEach((w) => console.warn(`[config] ${w}`));
    if (errors.length) {
      errors.forEach((e) => console.error(`[config] ${e}`));
      throw new Error('Unsafe production configuration. Fix the problems above and start again.');
    }
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Product CSV imports send a few thousand rows in one request.
  app.useBodyParser('json', { limit: '5mb' });
  const configService = app.get(ConfigService);

  // Behind a load balancer or proxy, trust it so rate limits see each client's real address.
  if (configService.get<string>('TRUST_PROXY')) (app as any).set('trust proxy', configService.get<string>('TRUST_PROXY') === 'true' ? 1 : configService.get<string>('TRUST_PROXY'));
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableShutdownHooks();
  

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
    // Development allows any origin; production only the addresses listed in CORS_ORIGINS (plus the desktop till).
    origin: (origin, callback) => callback(null, isOriginAllowed(origin, configService.get<string>('CORS_ORIGINS'), production)),
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

  // API documentation is for developers: off in production unless ENABLE_SWAGGER=true.
  if (!production || configService.get<string>('ENABLE_SWAGGER') === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Auvren Till API')
      .setDescription('API documentation for the Auvren Till backend services (products, sales, refunds, till sessions)')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

  }

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
  if (!production || configService.get<string>('ENABLE_SWAGGER') === 'true') console.log(`Swagger documentation: ${serverUrl}/api/docs`);
}
bootstrap();
