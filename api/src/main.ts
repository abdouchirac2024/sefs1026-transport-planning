import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DomainErrorFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new DomainErrorFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SEFS1026 — Planification des transports')
    .setDescription(
      "API de planification des transports (Afrikedge). Authentification simulée via l'en-tête " +
        'X-User-Id (diane = DISPATCHER, eric = LOGISTICS_MANAGER) ; voir la section "Utilisateurs de test" du README. ' +
        "L'en-tête est documenté sur chaque route avec @ApiHeader.",
    )
    .setVersion('1.0')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
