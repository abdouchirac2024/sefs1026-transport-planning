import { Injectable } from '@nestjs/common';
import { DatabaseService, sql } from '../database/database.service';
import { Page, toOffset } from '../common/pagination';
import { SalesOrderToPlanDto } from './dto/sales-order-to-plan.dto';
import { ToPlanQueryDto } from './dto/to-plan-query.dto';

interface SalesOrderToPlanRow extends SalesOrderToPlanDto {
  totalCount: number;
}

@Injectable()
export class SalesOrdersRepository {
  constructor(private readonly db: DatabaseService) {}

  /** Commandes au statut "À planifier" (0), filtrables par ville exacte, paginées. */
  async findToPlan(query: ToPlanQueryDto): Promise<Page<SalesOrderToPlanDto>> {
    const offset = toOffset(query.page, query.pageSize);

    const result = await this.db
      .request()
      .input('city', sql.NVarChar(50), query.city ?? null)
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, query.pageSize).query<SalesOrderToPlanRow>(`
        SELECT [No_]               AS no,
               [Customer No_]      AS customerNo,
               [Customer Name]     AS customerName,
               [Delivery City]     AS deliveryCity,
               [Total Weight (kg)] AS totalWeightKg,
               [Status]            AS status,
               COUNT(*) OVER()     AS totalCount
        FROM [Sales Order]
        WHERE [Status] = 0
          AND (@city IS NULL OR [Delivery City] = @city)
        ORDER BY [No_]
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `);

    const items: SalesOrderToPlanDto[] = result.recordset.map((row) => ({
      no: row.no,
      customerNo: row.customerNo,
      customerName: row.customerName,
      deliveryCity: row.deliveryCity,
      totalWeightKg: row.totalWeightKg,
      status: row.status,
    }));
    const total = result.recordset[0]?.totalCount ?? 0;

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /** Villes distinctes parmi les commandes "À planifier", pour peupler le filtre du front. */
  async findCities(): Promise<string[]> {
    const result = await this.db.request().query<{ city: string }>(`
      SELECT DISTINCT [Delivery City] AS city
      FROM [Sales Order]
      WHERE [Status] = 0
      ORDER BY [Delivery City]
    `);
    return result.recordset.map((row) => row.city);
  }
}
