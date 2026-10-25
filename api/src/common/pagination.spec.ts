import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PageQueryDto, toOffset } from './pagination';

describe('toOffset', () => {
  it('page 1 ne saute aucune ligne', () => {
    expect(toOffset(1, 20)).toBe(0);
  });

  it('page 2 avec pageSize 20 saute 20 lignes', () => {
    expect(toOffset(2, 20)).toBe(20);
  });

  it('page 3 avec pageSize 10 saute 20 lignes', () => {
    expect(toOffset(3, 10)).toBe(20);
  });
});

describe('PageQueryDto', () => {
  it('applique les valeurs par défaut (page=1, pageSize=20) quand rien n est fourni', async () => {
    const dto = plainToInstance(PageQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.pageSize).toBe(20);
  });

  it('accepte des valeurs explicites valides', async () => {
    const dto = plainToInstance(PageQueryDto, { page: '3', pageSize: '50' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(3);
    expect(dto.pageSize).toBe(50);
  });

  it('refuse page = 0', async () => {
    const dto = plainToInstance(PageQueryDto, { page: '0' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('refuse pageSize = 0', async () => {
    const dto = plainToInstance(PageQueryDto, { pageSize: '0' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'pageSize')).toBe(true);
  });

  it('refuse pageSize > 100', async () => {
    const dto = plainToInstance(PageQueryDto, { pageSize: '101' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'pageSize')).toBe(true);
  });

  it('refuse une page non entière', async () => {
    const dto = plainToInstance(PageQueryDto, { page: '1.5' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });
});
