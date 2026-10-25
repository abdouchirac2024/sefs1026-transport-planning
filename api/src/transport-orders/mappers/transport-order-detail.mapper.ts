import {
  TransportOrderDetailDto,
  TransportOrderHeaderRow,
  TransportOrderLineDto,
} from '../dto/transport-order-detail.dto';

/**
 * Assemble l'en-tête (ordre + véhicule) et les lignes (commandes) en un seul DTO,
 * en calculant le poids total et la capacité restante. Fonction pure : aucune I/O,
 * testable sans base de données.
 */
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
    lines,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
