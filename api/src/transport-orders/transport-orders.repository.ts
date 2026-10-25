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

  /** Liste paginée des ordres, filtrable par statut et par date, avec poids total et nombre de lignes agrégés. */
  async findAll(
    query: TransportOrdersQueryDto,
  ): Promise<Page<TransportOrderListItemDto>> {
    const offset = toOffset(query.page, query.pageSize);

    const result = await this.db
      .request()
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
               CONVERT(varchar(18), t.[timestamp], 1)  AS version,
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

  /** Détail d'un ordre (véhicule, lignes, poids total, capacité restante), ou null si introuvable. */
  async findDetail(no: string): Promise<TransportOrderDetailDto | null> {
    const headerResult = await this.db
      .request()
      .input('no', sql.NVarChar(20), no).query<TransportOrderHeaderRow>(`
        SELECT t.[No_]                              AS no,
               t.[Vehicle Code]                      AS vehicleCode,
               v.[Plate No_]                         AS plateNo,
               v.[Capacity (kg)]                     AS capacityKg,
               CONVERT(char(10), t.[Delivery Date], 23) AS deliveryDate,
               t.[Status]                             AS status,
               t.[Created By]                         AS createdBy,
               t.[Validated By]                       AS validatedBy,
               CONVERT(varchar(18), t.[timestamp], 1)  AS version
        FROM [Transport Order] t
        JOIN [Vehicle] v ON v.[Code] = t.[Vehicle Code]
        WHERE t.[No_] = @no
      `);

    const header = headerResult.recordset[0];
    if (!header) {
      return null;
    }

    const linesResult = await this.db
      .request()
      .input('no', sql.NVarChar(20), no).query<TransportOrderLineDto>(`
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
}
