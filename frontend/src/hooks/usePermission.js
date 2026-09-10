import { useAuth } from './useAuth';

/**
 * `can('create_inventory')` for conditional rendering.
 *
 * Hiding a control is a courtesy, not a security boundary — the matching
 * endpoint enforces the same permission server-side.
 */
export function usePermission() {
  const { can, canAny, hasRole } = useAuth();
  return { can, canAny, hasRole };
}
