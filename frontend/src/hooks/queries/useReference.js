import { useQuery } from '@tanstack/react-query';
import { categoriesApi, suppliersApi, warehousesApi, locationsApi } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';

/** Reference data barely changes; cache it for the length of a shift. */
const REFERENCE_OPTIONS = { staleTime: 10 * 60_000 };

export function useCategoriesQuery(params = { per_page: 200 }) {
  return useQuery({
    queryKey: queryKeys.reference.categories(params),
    queryFn: () => categoriesApi.list(params),
    ...REFERENCE_OPTIONS,
  });
}

export function useSuppliersQuery(params = { per_page: 200 }) {
  return useQuery({
    queryKey: queryKeys.reference.suppliers(params),
    queryFn: () => suppliersApi.list(params),
    ...REFERENCE_OPTIONS,
  });
}

export function useWarehousesQuery(params = { per_page: 100 }) {
  return useQuery({
    queryKey: queryKeys.reference.warehouses(params),
    queryFn: () => warehousesApi.list(params),
    ...REFERENCE_OPTIONS,
  });
}

export function useLocationsQuery(params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.reference.locations(params),
    queryFn: () => locationsApi.list(params),
    ...REFERENCE_OPTIONS,
    ...options,
  });
}

/** Shape a reference list as <Select> options. */
export function toSelectOptions(rows = [], { valueKey = 'id', labelKey = 'name' } = {}) {
  return rows.map((row) => ({ value: String(row[valueKey]), label: row[labelKey] }));
}
