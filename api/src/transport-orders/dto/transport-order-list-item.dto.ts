export interface TransportOrderListItemDto {
  no: string;
  vehicleCode: string;
  plateNo: string;
  capacityKg: number;
  deliveryDate: string;
  status: number;
  createdBy: string;
  validatedBy: string | null;
  version: string;
  totalWeightKg: number;
  lineCount: number;
}
