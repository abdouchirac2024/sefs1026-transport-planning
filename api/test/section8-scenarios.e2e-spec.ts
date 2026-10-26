import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { DatabaseService, sql } from '../src/database/database.service';
import { resetDatabase } from './helpers/reset-database';

/**
 * Scénarios de vérification de la section 8 du skill (sefs1026-transport-planning).
 * Nécessite SQL Server démarré. Ignoré par défaut pour que `npm run test:e2e` reste vert
 * sans base disponible : lancer avec `npm run test:e2e:live` (reset + E2E_DB=true).
 *
 * Regroupés par thème (lectures, création, capacité, rôles, transitions, concurrence).
 * Chaque groupe relance `db:reset` (beforeAll ou beforeEach) pour repartir de données
 * connues : AUCUN test ne doit dépendre de l'effet d'un autre test, y compris d'un autre
 * test du même groupe -- chacun doit pouvoir être lancé seul (`it.only` / testNamePattern)
 * et donner le même résultat. Les groupes "Capacité" et "Transitions" utilisent beforeEach
 * (et non beforeAll) car plusieurs de leurs tests mutent les mêmes lignes partagées
 * (TO-0003, SO-1027, TO-0002...) ; un simple beforeAll y aurait laissé un ordre implicite
 * entre tests.
 */
const describeWithDb = process.env.E2E_DB === 'true' ? describe : describe.skip;

/**
 * Date au format YYYY-MM-DD, décalée de `offsetDays` par rapport à aujourd'hui en UTC --
 * aligné sur CAST(GETDATE() AS date) côté SQL Server (voir "Date du jour" dans DECISIONS.md).
 */
function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

const YESTERDAY = isoDate(-1);
const TODAY = isoDate(0);
const TOMORROW = isoDate(1);

describeWithDb('Scénarios section 8 (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    db = moduleFixture.get(DatabaseService);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Lit directement le statut d'une commande en base : l'API ne l'expose pas individuellement. */
  async function salesOrderStatus(no: string): Promise<number> {
    const result = await db
      .request()
      .input('no', sql.NVarChar(20), no)
      .query<{ status: number }>(
        'SELECT [Status] AS status FROM [Sales Order] WHERE [No_] = @no',
      );
    return result.recordset[0].status;
  }

  describe('Lectures et authentification', () => {
    beforeAll(() => resetDatabase());

    it('GET /vehicles renvoie 9 véhicules actifs (VH-07 inactif exclu)', async () => {
      const response = await request(app.getHttpServer())
        .get('/vehicles')
        .set('X-User-Id', 'diane')
        .expect(200);
      expect(response.body).toHaveLength(9);
      expect(
        response.body.some((v: { code: string }) => v.code === 'VH-07'),
      ).toBe(false);
    });

    it('GET /sales-orders/to-plan renvoie 33 commandes (SO-1008 à SO-1040)', async () => {
      const response = await request(app.getHttpServer())
        .get('/sales-orders/to-plan')
        .query({ pageSize: 50 })
        .set('X-User-Id', 'diane')
        .expect(200);
      expect(response.body.total).toBe(33);
    });

    it('refuse sans X-User-Id (401)', async () => {
      await request(app.getHttpServer()).get('/vehicles').expect(401);
    });

    it('refuse avec X-User-Id inconnu "bob" (401)', async () => {
      await request(app.getHttpServer())
        .get('/vehicles')
        .set('X-User-Id', 'bob')
        .expect(401);
    });
  });

  describe('Création d ordres', () => {
    // Un seul test insère réellement (VH-05 aujourd'hui) ; les autres sont rejetés avant
    // toute écriture. Un beforeAll suffit : aucun des quatre ne dépend qu'un autre ait (ou
    // n'ait pas) tourné avant lui, seulement d'un état initial à 4 ordres (TO-0001..0004).
    beforeAll(() => resetDatabase());

    it('refuse la création sur VH-07 (inactif) -> 422 VEHICLE_INACTIVE', async () => {
      const response = await request(app.getHttpServer())
        .post('/transport-orders')
        .set('X-User-Id', 'diane')
        .send({ vehicleCode: 'VH-07', deliveryDate: TOMORROW })
        .expect(422);
      expect(response.body.code).toBe('VEHICLE_INACTIVE');
    });

    it('refuse la création sur VH-03 demain (déjà réservé par TO-0002) -> 409 VEHICLE_ALREADY_BOOKED', async () => {
      const response = await request(app.getHttpServer())
        .post('/transport-orders')
        .set('X-User-Id', 'diane')
        .send({ vehicleCode: 'VH-03', deliveryDate: TOMORROW })
        .expect(409);
      expect(response.body.code).toBe('VEHICLE_ALREADY_BOOKED');
    });

    it('refuse la création sur VH-05 hier -> 422 DELIVERY_DATE_IN_PAST', async () => {
      const response = await request(app.getHttpServer())
        .post('/transport-orders')
        .set('X-User-Id', 'diane')
        .send({ vehicleCode: 'VH-05', deliveryDate: YESTERDAY })
        .expect(422);
      expect(response.body.code).toBe('DELIVERY_DATE_IN_PAST');
    });

    it("crée un ordre sur VH-05 aujourd'hui -> 201, numéro TO-0005", async () => {
      const response = await request(app.getHttpServer())
        .post('/transport-orders')
        .set('X-User-Id', 'diane')
        .send({ vehicleCode: 'VH-05', deliveryDate: TODAY })
        .expect(201);
      expect(response.body.no).toBe('TO-0005');
      expect(response.body.status).toBe(0);
    });
  });

  describe('Capacité et affectation (TO-0003)', () => {
    // beforeEach, pas beforeAll : "SO-1027 alone succeeds" affecte SO-1027, ce que le test
    // "tout ou rien" suivant doit retrouver encore À planifier. Avec un seul beforeAll, l'ordre
    // d'écriture des tests deviendrait implicitement significatif -- exactement ce qu'on évite ici.
    beforeEach(() => resetDatabase());

    it('refuse TO-0003 + SO-1013 (145,50 kg) : dépasse la capacité (1 360/1 500 kg) -> 422 CAPACITY_EXCEEDED', async () => {
      const response = await request(app.getHttpServer())
        .post('/transport-orders/TO-0003/lines')
        .set('X-User-Id', 'diane')
        .send({ salesOrderNos: ['SO-1013'] })
        .expect(422);
      expect(response.body.code).toBe('CAPACITY_EXCEEDED');
    });

    it('refuse TO-0003 + [SO-1027, SO-1040] (145,25 kg) : dépasse, tout ou rien -> 422, aucune ajoutée', async () => {
      const response = await request(app.getHttpServer())
        .post('/transport-orders/TO-0003/lines')
        .set('X-User-Id', 'diane')
        .send({ salesOrderNos: ['SO-1027', 'SO-1040'] })
        .expect(422);
      expect(response.body.code).toBe('CAPACITY_EXCEEDED');

      expect(await salesOrderStatus('SO-1027')).toBe(0);
      expect(await salesOrderStatus('SO-1040')).toBe(0);
    });

    it('accepte TO-0003 + SO-1027 seule -> 200, 1 420,25 kg, SO-1027 Planifiée', async () => {
      const response = await request(app.getHttpServer())
        .post('/transport-orders/TO-0003/lines')
        .set('X-User-Id', 'diane')
        .send({ salesOrderNos: ['SO-1027'] })
        .expect(200);
      expect(response.body.totalWeightKg).toBe(1420.25);
      expect(await salesOrderStatus('SO-1027')).toBe(1);
    });

    it('refuse TO-0003 + SO-1003 (déjà dans TO-0002) -> 409 SALES_ORDER_NOT_PLANNABLE', async () => {
      const response = await request(app.getHttpServer())
        .post('/transport-orders/TO-0003/lines')
        .set('X-User-Id', 'diane')
        .send({ salesOrderNos: ['SO-1003'] })
        .expect(409);
      expect(response.body.code).toBe('SALES_ORDER_NOT_PLANNABLE');
    });
  });

  describe('Rôles', () => {
    beforeAll(() => resetDatabase());

    it('refuse la validation de TO-0003 par diane (DISPATCHER) -> 403 FORBIDDEN_ROLE', async () => {
      const response = await request(app.getHttpServer())
        .post('/transport-orders/TO-0003/validate')
        .set('X-User-Id', 'diane')
        .expect(403);
      expect(response.body.code).toBe('FORBIDDEN_ROLE');
    });
  });

  describe('Transitions de statut', () => {
    // beforeEach : plusieurs tests mutent TO-0003 ou TO-0002 (validation, retrait de ligne,
    // départ) -- chacun doit retrouver l'état initial de init.sql, pas celui laissé par le
    // test précédent du même groupe.
    beforeEach(() => resetDatabase());

    it('refuse la validation de TO-0004 (vide) par eric -> 422 EMPTY_ORDER', async () => {
      const response = await request(app.getHttpServer())
        .post('/transport-orders/TO-0004/validate')
        .set('X-User-Id', 'eric')
        .expect(422);
      expect(response.body.code).toBe('EMPTY_ORDER');
    });

    it('valide TO-0003 par eric -> 200, validatedBy = eric', async () => {
      const response = await request(app.getHttpServer())
        .post('/transport-orders/TO-0003/validate')
        .set('X-User-Id', 'eric')
        .expect(200);
      expect(response.body.status).toBe(1);
      expect(response.body.validatedBy).toBe('eric');
    });

    it('refuse l ajout de ligne sur TO-0002 (Validé) -> 409 ORDER_NOT_EDITABLE', async () => {
      const response = await request(app.getHttpServer())
        .post('/transport-orders/TO-0002/lines')
        .set('X-User-Id', 'diane')
        .send({ salesOrderNos: ['SO-1013'] })
        .expect(409);
      expect(response.body.code).toBe('ORDER_NOT_EDITABLE');
    });

    it('retire SO-1006 de TO-0003 -> 200, SO-1006 repasse À planifier', async () => {
      const response = await request(app.getHttpServer())
        .delete('/transport-orders/TO-0003/lines/SO-1006')
        .set('X-User-Id', 'diane')
        .expect(200);
      expect(
        response.body.lines.some(
          (l: { salesOrderNo: string }) => l.salesOrderNo === 'SO-1006',
        ),
      ).toBe(false);
      expect(await salesOrderStatus('SO-1006')).toBe(0);
    });

    it('refuse le départ de TO-0004 (Brouillon) -> 409 INVALID_STATUS_TRANSITION', async () => {
      const response = await request(app.getHttpServer())
        .post('/transport-orders/TO-0004/depart')
        .set('X-User-Id', 'diane')
        .expect(409);
      expect(response.body.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('marque TO-0002 Parti par diane -> 200, SO-1003/1004/1005 En livraison', async () => {
      const response = await request(app.getHttpServer())
        .post('/transport-orders/TO-0002/depart')
        .set('X-User-Id', 'diane')
        .expect(200);
      expect(response.body.status).toBe(2);

      expect(await salesOrderStatus('SO-1003')).toBe(2);
      expect(await salesOrderStatus('SO-1004')).toBe(2);
      expect(await salesOrderStatus('SO-1005')).toBe(2);
    });

    it('refuse le départ de TO-0001 (déjà parti) -> 409 INVALID_STATUS_TRANSITION', async () => {
      const response = await request(app.getHttpServer())
        .post('/transport-orders/TO-0001/depart')
        .set('X-User-Id', 'diane')
        .expect(409);
      expect(response.body.code).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  describe('Concurrence', () => {
    beforeAll(() => resetDatabase());

    it('deux ajouts concurrents de la même commande (SO-1008) dans deux ordres distincts : un seul réussit', async () => {
      const createA = await request(app.getHttpServer())
        .post('/transport-orders')
        .set('X-User-Id', 'diane')
        .send({ vehicleCode: 'VH-06', deliveryDate: TOMORROW })
        .expect(201);
      const createB = await request(app.getHttpServer())
        .post('/transport-orders')
        .set('X-User-Id', 'diane')
        .send({ vehicleCode: 'VH-08', deliveryDate: TOMORROW })
        .expect(201);

      const noA: string = createA.body.no;
      const noB: string = createB.body.no;

      const [resultA, resultB] = await Promise.all([
        request(app.getHttpServer())
          .post(`/transport-orders/${noA}/lines`)
          .set('X-User-Id', 'diane')
          .send({ salesOrderNos: ['SO-1008'] }),
        request(app.getHttpServer())
          .post(`/transport-orders/${noB}/lines`)
          .set('X-User-Id', 'diane')
          .send({ salesOrderNos: ['SO-1008'] }),
      ]);

      const statuses = [resultA.status, resultB.status].sort((a, b) => a - b);
      expect(statuses).toEqual([200, 409]);
      expect(await salesOrderStatus('SO-1008')).toBe(1);
    });
  });

  describe('Contrôle de concurrence optimiste (If-Match)', () => {
    // beforeAll suffit : chaque test crée son propre ordre, aucun partage d'état entre eux.
    beforeAll(() => resetDatabase());

    it('accepte la mutation quand If-Match correspond à la version actuelle', async () => {
      const created = await request(app.getHttpServer())
        .post('/transport-orders')
        .set('X-User-Id', 'diane')
        .send({ vehicleCode: 'VH-09', deliveryDate: TOMORROW })
        .expect(201);

      const version: string = created.body.version;
      expect(version).toMatch(/^0x[0-9a-fA-F]+$/);

      await request(app.getHttpServer())
        .post(`/transport-orders/${created.body.no}/lines`)
        .set('X-User-Id', 'diane')
        .set('If-Match', version)
        .send({ salesOrderNos: ['SO-1009'] })
        .expect(200);
    });

    it('refuse la mutation avec un If-Match périmé -> 412 STALE_VERSION', async () => {
      const created = await request(app.getHttpServer())
        .post('/transport-orders')
        .set('X-User-Id', 'diane')
        .send({ vehicleCode: 'VH-10', deliveryDate: TOMORROW })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post(`/transport-orders/${created.body.no}/lines`)
        .set('X-User-Id', 'diane')
        .set('If-Match', '0x0000000000000000')
        .send({ salesOrderNos: ['SO-1011'] })
        .expect(412);
      expect(response.body.code).toBe('STALE_VERSION');
    });
  });
});
