import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
  ) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Public liveness check: the tills ping it to know whether the server is reachable, and monitors use it too. */
  @SkipThrottle()
  @Get('health')
  async health() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({ status: 'down', database: 'down' });
    }
    return { status: 'ok', database: 'up', time: new Date().toISOString() };
  }
}
