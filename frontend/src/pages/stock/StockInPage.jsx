import { StockMovementForm } from './StockMovementForm';

/** Goods received. The direction is the only difference from stock out. */
export default function StockInPage() {
  return <StockMovementForm direction="in" />;
}
