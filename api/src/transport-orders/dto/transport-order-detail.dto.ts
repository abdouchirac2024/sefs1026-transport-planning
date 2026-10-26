export interface TransportOrderLineDto {
  salesOrderNo: string;
  customerName: string;
  deliveryCity: string;
  totalWeightKg: number;
}

export interface TransportOrderHeaderRow {
  no: string;
  vehicleCode: string;
  plateNo: string;
  capacityKg: number;
  deliveryDate: string;
  status: number;
  createdBy: string;
  validatedBy: string | null;
  version: string;
}

export interface TransportOrderDetailDto extends TransportOrderHeaderRow {
  totalWeightKg: number;
  remainingCapacityKg: number;
  lineCount: number;
  lines: TransportOrderLineDto[];
}
