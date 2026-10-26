import { Injectable } from '@nestjs/common';
import { DatabaseService, sql } from '../database/database.service';
import { VehicleDto } from './dto/vehicle.dto';

@Injectable()
export class VehiclesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findActive(): Promise<VehicleDto[]> {
    const result = await this.db.request().query<VehicleDto>(`
      SELECT [Code]          AS code,
             [Plate No_]     AS plateNo,
             [Capacity (kg)] AS capacityKg,
             [Active]        AS active
      FROM [Vehicle]
      WHERE [Active] = 1
      ORDER BY [Code]
    `);
    return result.recordset;
  }

  async findByCode(
    code: string,
    tx?: sql.Transaction,
  ): Promise<VehicleDto | null> {
    const request = tx ? this.db.requestIn(tx) : this.db.request();
    const result = await request.input('code', sql.NVarChar(20), code)
      .query<VehicleDto>(`
        SELECT [Code]          AS code,
               [Plate No_]     AS plateNo,
               [Capacity (kg)] AS capacityKg,
               [Active]        AS active
        FROM [Vehicle]
        WHERE [Code] = @code
      `);
    return result.recordset[0] ?? null;
  }
}
