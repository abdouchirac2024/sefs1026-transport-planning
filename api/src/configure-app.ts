import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DomainErrorFilter } from './common/filters/http-exception.filter';

/**
 * Configuration commune de l'application : ValidationPipe (validation + transformation des
 * DTO) et le filtre d'erreur global. Appelée à la fois par main.ts (serveur réel) et par les
 * tests e2e (Test.createTestingModule().createNestApplication()) : sans cette fonction, les
 * deux bootstraps divergeraient et les tests e2e ne vérifieraient pas le même comportement
 * que le serveur réellement déployé -- c'est exactement ce qui a été découvert lors de la
 * première vérification contre la vraie base (toutes les erreurs remontaient en 500 au lieu
 * du bon code HTTP, car les tests e2e ne posaient ni le pipe ni le filtre).
 */
export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new DomainErrorFilter());
}
