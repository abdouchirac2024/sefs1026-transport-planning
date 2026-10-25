import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TransportOrdersQueryDto } from './transport-orders-query.dto';

async function validateQuery(raw: Record<string, unknown>) {
  const dto = plainToInstance(TransportOrdersQueryDto, raw);
  const errors = await validate(dto);
  return { dto, errors };
}

describe('TransportOrdersQueryDto', () => {
  it('accepte une requête sans filtre (page/pageSize par défaut)', async () => {
    const { dto, errors } = await validateQuery({});
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.pageSize).toBe(20);
    expect(dto.status).toBeUndefined();
    expect(dto.date).toBeUndefined();
  });

  it.each([0, 1, 2])('accepte status = %i', async (status) => {
    const { errors } = await validateQuery({ status: String(status) });
    expect(errors).toHaveLength(0);
  });

  it('refuse un status hors de {0,1,2}', async () => {
    const { errors } = await validateQuery({ status: '3' });
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('accepte une date au format YYYY-MM-DD', async () => {
    const { errors } = await validateQuery({ date: '2026-01-15' });
    expect(errors).toHaveLength(0);
  });

  it.each([
    '15-01-2026',
    '2026/01/15',
    '2026-1-5',
    'hier',
    '2026-01-15T00:00:00Z',
  ])('refuse une date mal formée : %s', async (date) => {
    const { errors } = await validateQuery({ date });
    expect(errors.some((e) => e.property === 'date')).toBe(true);
  });
});
