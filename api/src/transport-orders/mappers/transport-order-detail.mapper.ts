import {
  TransportOrderDetailDto,
  TransportOrderHeaderRow,
  TransportOrderLineDto,
} from '../dto/transport-order-detail.dto';

export function toTransportOrderDetailDto(
  header: TransportOrderHeaderRow,
  lines: TransportOrderLineDto[],
): TransportOrderDetailDto {
  const totalWeightKg = round2(
    lines.reduce((sum, line) => sum + line.totalWeightKg, 0),
  );
  const remainingCapacityKg = round2(header.capacityKg - totalWeightKg);

  return {
    ...header,
    totalWeightKg,
    remainingCapacityKg,
    lineCount: lines.length,
    lines,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
