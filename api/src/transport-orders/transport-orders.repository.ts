import { Injectable } from '@nestjs/common';
import { Page, toOffset } from '../common/pagination';
import { DatabaseService, sql } from '../database/database.service';
import {
  TransportOrderDetailDto,
  TransportOrderHeaderRow,
  TransportOrderLineDto,
} from './dto/transport-order-detail.dto';
import { TransportOrderListItemDto } from './dto/transport-order-list-item.dto';
import { TransportOrdersQueryDto } from './dto/transport-orders-query.dto';
import { toTransportOrderDetailDto } from './mappers/transport-order-detail.mapper';

interface TransportOrderListRow extends TransportOrderListItemDto {
  totalCount: number;
}

@Injectable()
export class TransportOrdersRepository {
  constructor(private readonly db: DatabaseService) {}

  private req(tx?: sql.Transaction): sql.Request {
    return tx ? this.db.requestIn(tx) : this.db.request();
  }

  async findAll(
    query: TransportOrdersQueryDto,
  ): Promise<Page<TransportOrderListItemDto>> {
    const offset = toOffset(query.page, query.pageSize);

    const result = await this.req()
      .input('status', sql.TinyInt, query.status ?? null)
      .input('date', sql.NVarChar(10), query.date ?? null)
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, query.pageSize).query<TransportOrderListRow>(`
        SELECT t.[No_]                              AS no,
               t.[Vehicle Code]                      AS vehicleCode,
               v.[Plate No_]                         AS plateNo,
               v.[Capacity (kg)]                     AS capacityKg,
               CONVERT(char(10), t.[Delivery Date], 23) AS deliveryDate,
               t.[Status]                             AS status,
               t.[Created By]                         AS createdBy,
               t.[Validated By]                       AS validatedBy,
               master.dbo.fn_varbintohexstr(t.[timestamp]) AS version,
               ISNULL(SUM(so.[Total Weight (kg)]), 0) AS totalWeightKg,
               COUNT(l.[Sales Order No_])             AS lineCount,
               COUNT(*) OVER()                        AS totalCount
        FROM [Transport Order] t
        JOIN [Vehicle] v ON v.[Code] = t.[Vehicle Code]
        LEFT JOIN [Transport Order Line] l ON l.[Transport Order No_] = t.[No_]
        LEFT JOIN [Sales Order] so ON so.[No_] = l.[Sales Order No_]
        WHERE (@status IS NULL OR t.[Status] = @status)
          AND (@date IS NULL OR t.[Delivery Date] = CONVERT(date, @date, 23))
        GROUP BY t.[No_], t.[Vehicle Code], v.[Plate No_], v.[Capacity (kg)], t.[Delivery Date],
                 t.[Status], t.[Created By], t.[Validated By], t.[timestamp]
        ORDER BY t.[Delivery Date] DESC, t.[No_]
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `);

    const items: TransportOrderListItemDto[] = result.recordset.map((row) => ({
      no: row.no,
      vehicleCode: row.vehicleCode,
      plateNo: row.plateNo,
      capacityKg: row.capacityKg,
      deliveryDate: row.deliveryDate,
      status: row.status,
      createdBy: row.createdBy,
      validatedBy: row.validatedBy,
      version: row.version,
      totalWeightKg: row.totalWeightKg,
      lineCount: row.lineCount,
    }));
    const total = result.recordset[0]?.totalCount ?? 0;

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async findDetail(
    no: string,
    tx?: sql.Transaction,
  ): Promise<TransportOrderDetailDto | null> {
    const headerResult = await this.req(tx).input('no', sql.NVarChar(20), no)
      .query<TransportOrderHeaderRow>(`
        SELECT t.[No_]                              AS no,
               t.[Vehicle Code]                      AS vehicleCode,
               v.[Plate No_]                         AS plateNo,
               v.[Capacity (kg)]                     AS capacityKg,
               CONVERT(char(10), t.[Delivery Date], 23) AS deliveryDate,
               t.[Status]                             AS status,
               t.[Created By]                         AS createdBy,
               t.[Validated By]                       AS validatedBy,
               master.dbo.fn_varbintohexstr(t.[timestamp]) AS version
        FROM [Transport Order] t
        JOIN [Vehicle] v ON v.[Code] = t.[Vehicle Code]
        WHERE t.[No_] = @no
      `);

    const header = headerResult.recordset[0];
    if (!header) {
      return null;
    }

    const linesResult = await this.req(tx).input('no', sql.NVarChar(20), no)
      .query<TransportOrderLineDto>(`
        SELECT so.[No_]               AS salesOrderNo,
               so.[Customer Name]     AS customerName,
               so.[Delivery City]     AS deliveryCity,
               so.[Total Weight (kg)] AS totalWeightKg
        FROM [Transport Order Line] l
        JOIN [Sales Order] so ON so.[No_] = l.[Sales Order No_]
        WHERE l.[Transport Order No_] = @no
        ORDER BY so.[No_]
      `);

    return toTransportOrderDetailDto(header, linesResult.recordset);
  }

  async getServerToday(tx: sql.Transaction): Promise<string> {
    const result = await this.req(tx).query<{ today: string }>(`
      SELECT CONVERT(char(10), CAST(GETDATE() AS date), 23) AS today
    `);
    return result.recordset[0].today;
  }

  async acquireCreateLock(tx: sql.Transaction): Promise<void> {
    await this.req(tx)
      .input('resource', sql.NVarChar(50), 'transport-order:create')
      .query(
        `EXEC sp_getapplock @Resource = @resource, @LockMode = 'Exclusive', @LockOwner = 'Transaction'`,
      );
  }

  async existsForVehicleAndDate(
    vehicleCode: string,
    deliveryDate: string,
    tx: sql.Transaction,
  ): Promise<boolean> {
    const result = await this.req(tx)
      .input('vehicleCode', sql.NVarChar(20), vehicleCode)
      .input('deliveryDate', sql.NVarChar(10), deliveryDate).query(`
        SELECT 1 AS found
        FROM [Transport Order]
        WHERE [Vehicle Code] = @vehicleCode
          AND [Delivery Date] = CONVERT(date, @deliveryDate, 23)
      `);
    return result.recordset.length > 0;
  }

  async getLastNumber(tx: sql.Transaction): Promise<number> {
    const result = await this.req(tx).query<{ lastNumber: number }>(`
      SELECT ISNULL(MAX(CAST(SUBSTRING([No_], 4, 16) AS int)), 0) AS lastNumber
      FROM [Transport Order]
      WHERE [No_] LIKE N'TO-[0-9]%'
    `);
    return result.recordset[0].lastNumber;
  }

  async insert(
    no: string,
    vehicleCode: string,
    deliveryDate: string,
    createdBy: string,
    tx: sql.Transaction,
  ): Promise<void> {
    await this.req(tx)
      .input('no', sql.NVarChar(20), no)
      .input('vehicleCode', sql.NVarChar(20), vehicleCode)
      .input('deliveryDate', sql.NVarChar(10), deliveryDate)
      .input('createdBy', sql.NVarChar(50), createdBy).query(`
        INSERT INTO [Transport Order] ([No_], [Vehicle Code], [Delivery Date], [Status], [Created By])
        VALUES (@no, @vehicleCode, CONVERT(date, @deliveryDate, 23), 0, @createdBy)
      `);
  }

  async lockForUpdate(
    no: string,
    tx: sql.Transaction,
  ): Promise<{ status: number; version: string } | null> {
    const result = await this.req(tx).input('no', sql.NVarChar(20), no).query<{
      status: number;
      version: string;
    }>(`
        SELECT [Status]                             AS status,
               master.dbo.fn_varbintohexstr([timestamp]) AS version
        FROM [Transport Order] WITH (UPDLOCK, ROWLOCK)
        WHERE [No_] = @no
      `);
    return result.recordset[0] ?? null;
  }

  async getVehicleCapacity(no: string, tx: sql.Transaction): Promise<number> {
    const result = await this.req(tx).input('no', sql.NVarChar(20), no).query<{
      capacityKg: number;
    }>(`
        SELECT v.[Capacity (kg)] AS capacityKg
        FROM [Transport Order] t
        JOIN [Vehicle] v ON v.[Code] = t.[Vehicle Code]
        WHERE t.[No_] = @no
      `);
    return result.recordset[0].capacityKg;
  }

  async sumCurrentWeight(no: string, tx: sql.Transaction): Promise<number> {
    const result = await this.req(tx).input('no', sql.NVarChar(20), no).query<{
      currentWeightKg: number;
    }>(`
        SELECT ISNULL(SUM(so.[Total Weight (kg)]), 0) AS currentWeightKg
        FROM [Transport Order Line] l
        JOIN [Sales Order] so ON so.[No_] = l.[Sales Order No_]
        WHERE l.[Transport Order No_] = @no
      `);
    return result.recordset[0].currentWeightKg;
  }

  async countLines(no: string, tx: sql.Transaction): Promise<number> {
    const result = await this.req(tx).input('no', sql.NVarChar(20), no).query<{
      lineCount: number;
    }>(`
        SELECT COUNT(*) AS lineCount
        FROM [Transport Order Line]
        WHERE [Transport Order No_] = @no
      `);
    return result.recordset[0].lineCount;
  }

  async insertLines(
    no: string,
    salesOrderNos: string[],
    tx: sql.Transaction,
  ): Promise<void> {
    await this.req(tx)
      .input('no', sql.NVarChar(20), no)
      .input('nos', sql.NVarChar(sql.MAX), JSON.stringify(salesOrderNos))
      .query(`
        INSERT INTO [Transport Order Line] ([Transport Order No_], [Sales Order No_])
        SELECT @no, [value] FROM OPENJSON(@nos)
      `);
  }

  async deleteLine(
    no: string,
    salesOrderNo: string,
    tx: sql.Transaction,
  ): Promise<boolean> {
    const result = await this.req(tx)
      .input('no', sql.NVarChar(20), no)
      .input('salesOrderNo', sql.NVarChar(20), salesOrderNo).query(`
        DELETE FROM [Transport Order Line]
        WHERE [Transport Order No_] = @no AND [Sales Order No_] = @salesOrderNo
      `);
    return result.rowsAffected[0] > 0;
  }

  async markValidated(
    no: string,
    validatedBy: string,
    tx: sql.Transaction,
  ): Promise<void> {
    await this.req(tx)
      .input('no', sql.NVarChar(20), no)
      .input('validatedBy', sql.NVarChar(50), validatedBy).query(`
        UPDATE [Transport Order] SET [Status] = 1, [Validated By] = @validatedBy WHERE [No_] = @no
      `);
  }

  async markDeparted(no: string, tx: sql.Transaction): Promise<void> {
    await this.req(tx).input('no', sql.NVarChar(20), no).query(`
        UPDATE [Transport Order] SET [Status] = 2 WHERE [No_] = @no
      `);
  }

  async markLinesInDelivery(no: string, tx: sql.Transaction): Promise<void> {
    await this.req(tx).input('no', sql.NVarChar(20), no).query(`
        UPDATE [Sales Order]
        SET [Status] = 2
        WHERE [No_] IN (SELECT [Sales Order No_] FROM [Transport Order Line] WHERE [Transport Order No_] = @no)
      `);
  }

  async bumpVersion(no: string, tx: sql.Transaction): Promise<void> {
    await this.req(tx).input('no', sql.NVarChar(20), no).query(`
        UPDATE [Transport Order] SET [Status] = [Status] WHERE [No_] = @no
      `);
  }
}
