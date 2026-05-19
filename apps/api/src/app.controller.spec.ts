jest.mock('./app.service', () => ({
  AppService: jest.fn().mockImplementation(() => ({
    getHello: () => 'SaaS Pulse API',
    getHealth: jest.fn(),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return API greeting', () => {
      expect(appController.getHello()).toBe('SaaS Pulse API');
    });
  });
});
