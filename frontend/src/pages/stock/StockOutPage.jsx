import { StockMovementForm } from './StockMovementForm';

/** Goods issued out of the warehouse, outside a counter sale. */
export default function StockOutPage() {
  return <StockMovementForm direction="out" />;
}
