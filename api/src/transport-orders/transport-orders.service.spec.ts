import { HttpStatus } from '@nestjs/common';
import { Role } from '../auth/role.enum';
import { User } from '../auth/users';
import { DomainError } from '../common/errors/domain-error';
import { ErrorCode } from '../common/errors/error-codes';
import { DatabaseService, sql } from '../database/database.service';
import { SalesOrdersRepository } from '../sales-orders/sales-orders.repository';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import { TransportOrderDetailDto } from './dto/transport-order-detail.dto';
import { TransportOrdersRepository } from './transport-orders.repository';
import { TransportOrdersService } from './transport-orders.service';

describe('TransportOrdersService', () => {
  let service: TransportOrdersService;
  let db: { withTransaction: jest.Mock };
  let transportOrders: jest.Mocked<
    Pick<
      TransportOrdersRepository,
      | 'acquireCreateLock'
      | 'getServerToday'
      | 'existsForVehicleAndDate'
      | 'getLastNumber'
      | 'insert'
      | 'lockForUpdate'
      | 'getVehicleCapacity'
      | 'sumCurrentWeight'
      | 'countLines'
      | 'insertLines'
      | 'deleteLine'
      | 'markValidated'
      | 'markDeparted'
      | 'markLinesInDelivery'
      | 'bumpVersion'
      | 'findDetail'
    >
  >;
  let vehicles: jest.Mocked<Pick<VehiclesRepository, 'findByCode'>>;
  let salesOrders: jest.Mocked<
    Pick<
      SalesOrdersRepository,
      'findByNosForUpdate' | 'markPlanned' | 'markToPlan'
    >
  >;

  const fakeTx = {} as sql.Transaction;

  const diane: User = { id: 'diane', role: Role.DISPATCHER };
  const eric: User = { id: 'eric', role: Role.LOGISTICS_MANAGER };

  const detail = { no: 'TO-0005' } as TransportOrderDetailDto;

  beforeEach(() => {
    db = {
      withTransaction: jest.fn((fn: (tx: sql.Transaction) => unknown) =>
        fn(fakeTx),
      ),
    };

    transportOrders = {
      acquireCreateLock: jest.fn().mockResolvedValue(undefined),
      getServerToday: jest.fn().mockResolvedValue('2026-01-01'),
      existsForVehicleAndDate: jest.fn().mockResolvedValue(false),
      getLastNumber: jest.fn().mockResolvedValue(4),
      insert: jest.fn().mockResolvedValue(undefined),
      lockForUpdate: jest.fn().mockResolvedValue({ status: 0, version: 'v1' }),
      getVehicleCapacity: jest.fn().mockResolvedValue(1500),
      sumCurrentWeight: jest.fn().mockResolvedValue(1360),
      countLines: jest.fn().mockResolvedValue(1),
      insertLines: jest.fn().mockResolvedValue(undefined),
      deleteLine: jest.fn().mockResolvedValue(true),
      markValidated: jest.fn().mockResolvedValue(undefined),
      markDeparted: jest.fn().mockResolvedValue(undefined),
      markLinesInDelivery: jest.fn().mockResolvedValue(undefined),
      bumpVersion: jest.fn().mockResolvedValue(undefined),
      findDetail: jest.fn().mockResolvedValue(detail),
    };

    vehicles = {
      findByCode: jest.fn().mockResolvedValue({
        code: 'VH-01',
        plateNo: 'LT-482-AB',
        capacityKg: 1500,
        active: true,
      }),
    };

    salesOrders = {
      findByNosForUpdate: jest
        .fn()
        .mockResolvedValue([
          { no: 'SO-1027', status: 0, totalWeightKg: 60.25 },
        ]),
      markPlanned: jest.fn().mockResolvedValue(1),
      markToPlan: jest.fn().mockResolvedValue(undefined),
    };

    service = new TransportOrdersService(
      db as unknown as DatabaseService,
      transportOrders as unknown as TransportOrdersRepository,
      vehicles as unknown as VehiclesRepository,
      salesOrders as unknown as SalesOrdersRepository,
    );
  });

  describe('create', () => {
    it('crée l ordre quand le véhicule est actif, la date valide et libre', async () => {
      const result = await service.create(
        { vehicleCode: 'VH-01', deliveryDate: '2026-01-02' },
        diane,
      );

      expect(transportOrders.acquireCreateLock).toHaveBeenCalledWith(fakeTx);
      expect(transportOrders.insert).toHaveBeenCalledWith(
        'TO-0005',
        'VH-01',
        '2026-01-02',
        'diane',
        fakeTx,
      );
      expect(result).toBe(detail);
    });

    it('rejette sans insérer si le véhicule est inactif', async () => {
      vehicles.findByCode.mockResolvedValue({
        code: 'VH-07',
        plateNo: 'LT-377-NP',
        capacityKg: 3500,
        active: false,
      });

      await expect(
        service.create(
          { vehicleCode: 'VH-07', deliveryDate: '2026-01-02' },
          diane,
        ),
      ).rejects.toMatchObject({
        code: ErrorCode.VEHICLE_INACTIVE,
        httpStatus: HttpStatus.UNPROCESSABLE_ENTITY,
      } satisfies Partial<DomainError>);
      expect(transportOrders.insert).not.toHaveBeenCalled();
    });

    it('rejette sans insérer si le véhicule est déjà réservé à cette date', async () => {
      transportOrders.existsForVehicleAndDate.mockResolvedValue(true);

      await expect(
        service.create(
          { vehicleCode: 'VH-01', deliveryDate: '2026-01-02' },
          diane,
        ),
      ).rejects.toMatchObject({
        code: ErrorCode.VEHICLE_ALREADY_BOOKED,
      } satisfies Partial<DomainError>);
      expect(transportOrders.insert).not.toHaveBeenCalled();
    });
  });

  describe('addLines', () => {
    it('ajoute les lignes, fait passer les commandes à Planifiée, et incrémente la version', async () => {
      await service.addLines('TO-0003', ['SO-1027'], undefined);

      expect(transportOrders.insertLines).toHaveBeenCalledWith(
        'TO-0003',
        ['SO-1027'],
        fakeTx,
      );
      expect(salesOrders.markPlanned).toHaveBeenCalledWith(['SO-1027'], fakeTx);
      expect(transportOrders.bumpVersion).toHaveBeenCalledWith(
        'TO-0003',
        fakeTx,
      );

      const insertOrder =
        transportOrders.insertLines.mock.invocationCallOrder[0];
      const markPlannedOrder =
        salesOrders.markPlanned.mock.invocationCallOrder[0];
      const bumpOrder = transportOrders.bumpVersion.mock.invocationCallOrder[0];
      expect(insertOrder).toBeLessThan(markPlannedOrder);
      expect(markPlannedOrder).toBeLessThan(bumpOrder);
    });

    it('rejette sans rien écrire si l ordre n est pas trouvé', async () => {
      transportOrders.lockForUpdate.mockResolvedValue(null);

      await expect(
        service.addLines('TO-9999', ['SO-1027'], undefined),
      ).rejects.toMatchObject({
        code: ErrorCode.TRANSPORT_ORDER_NOT_FOUND,
        httpStatus: HttpStatus.NOT_FOUND,
      } satisfies Partial<DomainError>);
      expect(transportOrders.insertLines).not.toHaveBeenCalled();
    });

    it('rejette sans rien écrire si l ordre n est plus au statut Brouillon', async () => {
      transportOrders.lockForUpdate.mockResolvedValue({
        status: 1,
        version: 'v1',
      });

      await expect(
        service.addLines('TO-0002', ['SO-1027'], undefined),
      ).rejects.toMatchObject({
        code: ErrorCode.ORDER_NOT_EDITABLE,
      } satisfies Partial<DomainError>);
      expect(transportOrders.insertLines).not.toHaveBeenCalled();
    });

    it('rejette sans rien écrire si la capacité est dépassée', async () => {
      transportOrders.sumCurrentWeight.mockResolvedValue(1450);

      await expect(
        service.addLines('TO-0003', ['SO-1027'], undefined),
      ).rejects.toMatchObject({
        code: ErrorCode.CAPACITY_EXCEEDED,
      } satisfies Partial<DomainError>);
      expect(transportOrders.insertLines).not.toHaveBeenCalled();
    });

    it('rejette si une commande demandée n existe pas', async () => {
      salesOrders.findByNosForUpdate.mockResolvedValue([]);

      await expect(
        service.addLines('TO-0003', ['SO-9999'], undefined),
      ).rejects.toMatchObject({
        code: ErrorCode.SALES_ORDER_NOT_FOUND,
      } satisfies Partial<DomainError>);
      expect(transportOrders.insertLines).not.toHaveBeenCalled();
    });

    it('détecte une affectation concurrente via le garde-fou rowsAffected (markPlanned < attendu)', async () => {
      salesOrders.markPlanned.mockResolvedValue(0);

      await expect(
        service.addLines('TO-0003', ['SO-1027'], undefined),
      ).rejects.toMatchObject({
        code: ErrorCode.SALES_ORDER_NOT_PLANNABLE,
        httpStatus: HttpStatus.CONFLICT,
      } satisfies Partial<DomainError>);
      expect(transportOrders.bumpVersion).not.toHaveBeenCalled();
    });

    it('rejette si la version fournie (If-Match) ne correspond plus', async () => {
      await expect(
        service.addLines('TO-0003', ['SO-1027'], 'version-perimee'),
      ).rejects.toMatchObject({
        code: ErrorCode.STALE_VERSION,
        httpStatus: HttpStatus.PRECONDITION_FAILED,
      } satisfies Partial<DomainError>);
      expect(transportOrders.insertLines).not.toHaveBeenCalled();
    });

    it('accepte si la version fournie (If-Match) correspond', async () => {
      await expect(
        service.addLines('TO-0003', ['SO-1027'], 'v1'),
      ).resolves.toBe(detail);
    });
  });

  describe('removeLine', () => {
    it('retire la ligne et repasse la commande à À planifier', async () => {
      await service.removeLine('TO-0003', 'SO-1006', undefined);

      expect(transportOrders.deleteLine).toHaveBeenCalledWith(
        'TO-0003',
        'SO-1006',
        fakeTx,
      );
      expect(salesOrders.markToPlan).toHaveBeenCalledWith('SO-1006', fakeTx);
      expect(transportOrders.bumpVersion).toHaveBeenCalledWith(
        'TO-0003',
        fakeTx,
      );
    });

    it('rejette si la commande ne fait pas partie de l ordre', async () => {
      transportOrders.deleteLine.mockResolvedValue(false);

      await expect(
        service.removeLine('TO-0003', 'SO-9999', undefined),
      ).rejects.toMatchObject({
        code: ErrorCode.TRANSPORT_ORDER_LINE_NOT_FOUND,
        httpStatus: HttpStatus.NOT_FOUND,
      } satisfies Partial<DomainError>);
      expect(salesOrders.markToPlan).not.toHaveBeenCalled();
    });

    it('rejette sur un ordre déjà Validé', async () => {
      transportOrders.lockForUpdate.mockResolvedValue({
        status: 1,
        version: 'v1',
      });

      await expect(
        service.removeLine('TO-0002', 'SO-1003', undefined),
      ).rejects.toMatchObject({
        code: ErrorCode.ORDER_NOT_EDITABLE,
      } satisfies Partial<DomainError>);
      expect(transportOrders.deleteLine).not.toHaveBeenCalled();
    });
  });

  describe('validate', () => {
    it('valide un ordre Brouillon non vide par un LOGISTICS_MANAGER', async () => {
      await service.validate('TO-0003', eric, undefined);

      expect(transportOrders.markValidated).toHaveBeenCalledWith(
        'TO-0003',
        'eric',
        fakeTx,
      );
    });

    it('rejette sans valider si l utilisateur est DISPATCHER', async () => {
      await expect(
        service.validate('TO-0003', diane, undefined),
      ).rejects.toMatchObject({
        code: ErrorCode.FORBIDDEN_ROLE,
        httpStatus: HttpStatus.FORBIDDEN,
      } satisfies Partial<DomainError>);
      expect(transportOrders.markValidated).not.toHaveBeenCalled();
    });

    it('rejette sans valider un ordre vide', async () => {
      transportOrders.countLines.mockResolvedValue(0);

      await expect(
        service.validate('TO-0004', eric, undefined),
      ).rejects.toMatchObject({
        code: ErrorCode.EMPTY_ORDER,
      } satisfies Partial<DomainError>);
      expect(transportOrders.markValidated).not.toHaveBeenCalled();
    });
  });

  describe('depart', () => {
    it('marque un ordre Validé comme Parti et fait passer ses commandes En livraison', async () => {
      transportOrders.lockForUpdate.mockResolvedValue({
        status: 1,
        version: 'v1',
      });

      await service.depart('TO-0002', undefined);

      expect(transportOrders.markDeparted).toHaveBeenCalledWith(
        'TO-0002',
        fakeTx,
      );
      expect(transportOrders.markLinesInDelivery).toHaveBeenCalledWith(
        'TO-0002',
        fakeTx,
      );
    });

    it('rejette le départ d un ordre encore Brouillon', async () => {
      await expect(service.depart('TO-0003', undefined)).rejects.toMatchObject({
        code: ErrorCode.INVALID_STATUS_TRANSITION,
      } satisfies Partial<DomainError>);
      expect(transportOrders.markDeparted).not.toHaveBeenCalled();
    });
  });
});
