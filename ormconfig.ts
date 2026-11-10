import { databaseSsl } from './src/infrastructure/config/database-ssl';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { ConfigService } from '@nestjs/config';

const createDatabaseConfig = (configService: ConfigService): PostgresConnectionOptions => ({
  type: 'postgres',
  host: configService.get<string>('DATABASE_HOST'),
  port: configService.get<number>('DATABASE_PORT'),
  username: configService.get<string>('DATABASE_USERNAME'),
  password: configService.get<string>('DATABASE_PASSWORD'),
  database: configService.get<string>('DATABASE_NAME'),
  entities: [__dirname + '/dist/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/dist/infrastructure/database/migrations/*{.ts,.js}'],
  synchronize: configService.get<string>('NODE_ENV') === 'development',
  logging: configService.get<string>('NODE_ENV') === 'development',
  ssl: databaseSsl({ NODE_ENV: configService.get<string>('NODE_ENV'), DATABASE_SSL: configService.get<string>('DATABASE_SSL') }),
  
});

export default createDatabaseConfig;
