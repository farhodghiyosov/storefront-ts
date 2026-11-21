export const FREE_SHIPPING_THRESHOLD = 1_000_000;
export const SHIPPING_PRICE = 39_000;
export function calculateTotals(items: { price: number; quantity: number }[]) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_PRICE;
  return { subtotal, shipping, total: subtotal + shipping };
}
