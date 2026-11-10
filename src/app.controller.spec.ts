import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  const build = async (query: jest.Mock) => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: DataSource, useValue: { query } }],
    }).compile();
    return app.get<AppController>(AppController);
  };

  it('should return "Hello World!"', async () => {
    expect((await build(jest.fn())).getHello()).toBe('Hello World!');
  });

  it('health is ok when the database answers', async () => {
    const res = await (await build(jest.fn().mockResolvedValue([{ '?column?': 1 }]))).health();
    expect(res).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('health is 503 when the database is down', async () => {
    const controller = await build(jest.fn().mockRejectedValue(new Error('connection refused')));
    await expect(controller.health()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
