import { HttpStatus, Injectable } from '@nestjs/common';
import { User } from '../auth/users';
import { DomainError } from '../common/errors/domain-error';
import { ErrorCode } from '../common/errors/error-codes';
import { DatabaseService, sql } from '../database/database.service';
import { SalesOrdersRepository } from '../sales-orders/sales-orders.repository';
import { VehiclesRepository } from '../vehicles/vehicles.repository';
import {
  assertCanCreate,
  assertCanDepart,
  assertCanValidate,
  assertCapacity,
  assertEditable,
  assertPlannable,
  nextTransportOrderNo,
} from './domain/transport-order.rules';
import { TransportOrderDetailDto } from './dto/transport-order-detail.dto';
import { TransportOrdersRepository } from './transport-orders.repository';

@Injectable()
export class TransportOrdersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly transportOrders: TransportOrdersRepository,
    private readonly vehicles: VehiclesRepository,
    private readonly salesOrders: SalesOrdersRepository,
  ) {}

  async create(
    input: { vehicleCode: string; deliveryDate: string },
    user: User,
  ): Promise<TransportOrderDetailDto> {
    return this.db.withTransaction(async (tx) => {
      await this.transportOrders.acquireCreateLock(tx);

      const vehicle = await this.vehicles.findByCode(input.vehicleCode, tx);
      const today = await this.transportOrders.getServerToday(tx);
      const existingOrderForVehicleAndDate =
        await this.transportOrders.existsForVehicleAndDate(
          input.vehicleCode,
          input.deliveryDate,
          tx,
        );

      assertCanCreate({
        vehicle: vehicle ? { active: vehicle.active } : null,
        deliveryDate: input.deliveryDate,
        today,
        existingOrderForVehicleAndDate,
      });

      const lastNumber = await this.transportOrders.getLastNumber(tx);
      const no = nextTransportOrderNo(lastNumber);

      await this.transportOrders.insert(
        no,
        input.vehicleCode,
        input.deliveryDate,
        user.id,
        tx,
      );

      return this.mustFindDetail(no, tx);
    });
  }

  async addLines(
    no: string,
    salesOrderNos: string[],
    ifMatch?: string,
  ): Promise<TransportOrderDetailDto> {
    return this.db.withTransaction(async (tx) => {
      const locked = await this.transportOrders.lockForUpdate(no, tx);
      this.assertFound(locked, no);
      this.assertVersionMatches(locked.version, ifMatch);
      assertEditable({ status: locked.status });

      const found = await this.salesOrders.findByNosForUpdate(
        salesOrderNos,
        tx,
      );
      assertPlannable(salesOrderNos, found);

      const capacityKg = await this.transportOrders.getVehicleCapacity(no, tx);
      const currentKg = await this.transportOrders.sumCurrentWeight(no, tx);
      const addedKg = found.reduce((sum, so) => sum + so.totalWeightKg, 0);
      assertCapacity(capacityKg, currentKg, addedKg);

      await this.transportOrders.insertLines(no, salesOrderNos, tx);

      const updatedCount = await this.salesOrders.markPlanned(
        salesOrderNos,
        tx,
      );
      if (updatedCount !== salesOrderNos.length) {
        throw new DomainError(
          ErrorCode.SALES_ORDER_NOT_PLANNABLE,
          'Une ou plusieurs commandes ont été affectées à un autre ordre entre-temps.',
          HttpStatus.CONFLICT,
        );
      }

      await this.transportOrders.bumpVersion(no, tx);

      return this.mustFindDetail(no, tx);
    });
  }

  async removeLine(
    no: string,
    salesOrderNo: string,
    ifMatch?: string,
  ): Promise<TransportOrderDetailDto> {
    return this.db.withTransaction(async (tx) => {
      const locked = await this.transportOrders.lockForUpdate(no, tx);
      this.assertFound(locked, no);
      this.assertVersionMatches(locked.version, ifMatch);
      assertEditable({ status: locked.status });

      const deleted = await this.transportOrders.deleteLine(
        no,
        salesOrderNo,
        tx,
      );
      if (!deleted) {
        throw new DomainError(
          ErrorCode.TRANSPORT_ORDER_LINE_NOT_FOUND,
          `La commande ${salesOrderNo} ne fait pas partie de l'ordre ${no}.`,
          HttpStatus.NOT_FOUND,
        );
      }

      await this.salesOrders.markToPlan(salesOrderNo, tx);
      await this.transportOrders.bumpVersion(no, tx);

      return this.mustFindDetail(no, tx);
    });
  }

  async validate(
    no: string,
    user: User,
    ifMatch?: string,
  ): Promise<TransportOrderDetailDto> {
    return this.db.withTransaction(async (tx) => {
      const locked = await this.transportOrders.lockForUpdate(no, tx);
      this.assertFound(locked, no);
      this.assertVersionMatches(locked.version, ifMatch);

      const lineCount = await this.transportOrders.countLines(no, tx);
      assertCanValidate({ status: locked.status, lineCount }, user.role);

      await this.transportOrders.markValidated(no, user.id, tx);

      return this.mustFindDetail(no, tx);
    });
  }

  async depart(no: string, ifMatch?: string): Promise<TransportOrderDetailDto> {
    return this.db.withTransaction(async (tx) => {
      const locked = await this.transportOrders.lockForUpdate(no, tx);
      this.assertFound(locked, no);
      this.assertVersionMatches(locked.version, ifMatch);
      assertCanDepart({ status: locked.status });

      await this.transportOrders.markDeparted(no, tx);
      await this.transportOrders.markLinesInDelivery(no, tx);

      return this.mustFindDetail(no, tx);
    });
  }

  private assertFound(
    locked: { status: number; version: string } | null,
    no: string,
  ): asserts locked is { status: number; version: string } {
    if (!locked) {
      throw new DomainError(
        ErrorCode.TRANSPORT_ORDER_NOT_FOUND,
        `Ordre de transport introuvable : ${no}.`,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private assertVersionMatches(currentVersion: string, ifMatch?: string): void {
    if (ifMatch && ifMatch !== currentVersion) {
      throw new DomainError(
        ErrorCode.STALE_VERSION,
        "La version de l'ordre a changé depuis sa dernière lecture, veuillez recharger les données.",
        HttpStatus.PRECONDITION_FAILED,
      );
    }
  }

  private async mustFindDetail(
    no: string,
    tx: sql.Transaction,
  ): Promise<TransportOrderDetailDto> {
    const detail = await this.transportOrders.findDetail(no, tx);
    if (!detail) {
      throw new Error(
        `Ordre ${no} introuvable juste après une écriture : incohérence inattendue.`,
      );
    }
    return detail;
  }
}
