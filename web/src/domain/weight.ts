export function sumWeightKg(orders: { totalWeightKg: number }[]): number {
  return orders.reduce((sum, order) => sum + order.totalWeightKg, 0);
}
