import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ToPlanQueryDto } from './to-plan-query.dto';

describe('ToPlanQueryDto', () => {
  it('accepte une requête sans ville (toutes villes)', async () => {
    const dto = plainToInstance(ToPlanQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.city).toBeUndefined();
  });

  it('accepte une ville valide', async () => {
    const dto = plainToInstance(ToPlanQueryDto, { city: 'Douala' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.city).toBe('Douala');
  });

  it('refuse une ville trop longue (> 50 caractères)', async () => {
    const dto = plainToInstance(ToPlanQueryDto, { city: 'D'.repeat(51) });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'city')).toBe(true);
  });
});
