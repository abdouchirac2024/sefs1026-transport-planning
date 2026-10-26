import {
  TransportOrderHeaderRow,
  TransportOrderLineDto,
} from '../dto/transport-order-detail.dto';
import { toTransportOrderDetailDto } from './transport-order-detail.mapper';

const header: TransportOrderHeaderRow = {
  no: 'TO-0003',
  vehicleCode: 'VH-01',
  plateNo: 'LT-482-AB',
  capacityKg: 1500,
  deliveryDate: '2026-01-15',
  status: 0,
  createdBy: 'diane',
  validatedBy: null,
  version: '0x0000000000001234',
};

describe('toTransportOrderDetailDto', () => {
  it('assemble l en-tête et les lignes en conservant tous les champs camelCase', () => {
    const lines: TransportOrderLineDto[] = [
      {
        salesOrderNo: 'SO-1006',
        customerName: 'Agro Distribution Ouest',
        deliveryCity: 'Bafoussam',
        totalWeightKg: 640,
      },
    ];

    const dto = toTransportOrderDetailDto(header, lines);

    expect(dto.no).toBe('TO-0003');
    expect(dto.vehicleCode).toBe('VH-01');
    expect(dto.lines).toEqual(lines);
  });

  it('calcule le poids total comme la somme des lignes', () => {
    const lines: TransportOrderLineDto[] = [
      {
        salesOrderNo: 'SO-1006',
        customerName: 'A',
        deliveryCity: 'Bafoussam',
        totalWeightKg: 640,
      },
      {
        salesOrderNo: 'SO-1007',
        customerName: 'B',
        deliveryCity: 'Bafoussam',
        totalWeightKg: 720,
      },
    ];

    const dto = toTransportOrderDetailDto(header, lines);

    expect(dto.totalWeightKg).toBe(1360);
  });

  it('calcule la capacité restante (capacité - poids total)', () => {
    const lines: TransportOrderLineDto[] = [
      {
        salesOrderNo: 'SO-1006',
        customerName: 'A',
        deliveryCity: 'Bafoussam',
        totalWeightKg: 640,
      },
      {
        salesOrderNo: 'SO-1007',
        customerName: 'B',
        deliveryCity: 'Bafoussam',
        totalWeightKg: 720,
      },
    ];

    const dto = toTransportOrderDetailDto(header, lines);

    expect(dto.remainingCapacityKg).toBe(140);
  });

  it('renvoie un poids total et une capacité restante à zéro pour un ordre sans ligne', () => {
    const dto = toTransportOrderDetailDto(header, []);

    expect(dto.totalWeightKg).toBe(0);
    expect(dto.remainingCapacityKg).toBe(1500);
    expect(dto.lines).toEqual([]);
  });

  it('renvoie lineCount égal au nombre de lignes (nécessaire à assertCanValidate côté API et à canValidate côté front)', () => {
    const lines: TransportOrderLineDto[] = [
      {
        salesOrderNo: 'SO-1006',
        customerName: 'A',
        deliveryCity: 'Bafoussam',
        totalWeightKg: 640,
      },
      {
        salesOrderNo: 'SO-1007',
        customerName: 'B',
        deliveryCity: 'Bafoussam',
        totalWeightKg: 720,
      },
    ];

    const dto = toTransportOrderDetailDto(header, lines);

    expect(dto.lineCount).toBe(2);
  });

  it('renvoie lineCount à zéro pour un ordre sans ligne', () => {
    const dto = toTransportOrderDetailDto(header, []);

    expect(dto.lineCount).toBe(0);
  });

  it('arrondit à 2 décimales sans erreur d arrondi flottant (60,25 + 85)', () => {
    const lines: TransportOrderLineDto[] = [
      {
        salesOrderNo: 'SO-1027',
        customerName: 'A',
        deliveryCity: 'Douala',
        totalWeightKg: 60.25,
      },
      {
        salesOrderNo: 'SO-1040',
        customerName: 'B',
        deliveryCity: 'Yaoundé',
        totalWeightKg: 85,
      },
    ];

    const dto = toTransportOrderDetailDto(header, lines);

    expect(dto.totalWeightKg).toBe(145.25);
    expect(dto.remainingCapacityKg).toBe(1354.75);
  });
});
