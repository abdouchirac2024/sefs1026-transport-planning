import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';

const describeWithDb = process.env.E2E_DB === 'true' ? describe : describe.skip;

describeWithDb('GET /vehicles (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuse sans X-User-Id (401 UNAUTHENTICATED)', async () => {
    const response = await request(app.getHttpServer())
      .get('/vehicles')
      .expect(401);
    expect(response.body.code).toBe('UNAUTHENTICATED');
  });

  it('refuse un X-User-Id inconnu (401 UNAUTHENTICATED)', async () => {
    const response = await request(app.getHttpServer())
      .get('/vehicles')
      .set('X-User-Id', 'bob')
      .expect(401);
    expect(response.body.code).toBe('UNAUTHENTICATED');
  });

  it('renvoie uniquement les véhicules actifs, en camelCase', async () => {
    const response = await request(app.getHttpServer())
      .get('/vehicles')
      .set('X-User-Id', 'diane')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(9);
    expect(
      response.body.some((v: { code: string }) => v.code === 'VH-07'),
    ).toBe(false);

    const first = response.body[0];
    expect(first).toHaveProperty('code');
    expect(first).toHaveProperty('plateNo');
    expect(first).toHaveProperty('capacityKg');
    expect(first).toHaveProperty('active', true);
  });
});
