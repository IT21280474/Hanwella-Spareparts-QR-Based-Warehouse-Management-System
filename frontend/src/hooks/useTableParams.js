import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_PAGE_SIZE } from '@/constants';

/**
 * Table state (search, filters, sort, page) held in the URL.
 *
 * Keeping it there rather than in component state means a filtered view can be
 * shared or bookmarked, the back button behaves, and paging cannot silently
 * drop the filters that produced the page.
 */
export function useTableParams({ defaults = {}, sort: defaultSort = null, direction: defaultDirection = 'desc' } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(() => {
    const current = { ...defaults };
    searchParams.forEach((value, key) => {
      current[key] = value;
    });
    return current;
  }, [searchParams, defaults]);

  const page = Number(params.page) || 1;
  const perPage = Number(params.per_page) || DEFAULT_PAGE_SIZE;
  const sort = params.sort || defaultSort;
  const direction = params.direction || defaultDirection;
  const search = params.search || '';

  /** Change one or more values. Anything but `page` resets to the first page. */
  const setParams = useCallback(
    (updates, { resetPage = true } = {}) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);

          Object.entries(updates).forEach(([key, value]) => {
            if (value === '' || value === null || value === undefined || value === 'All') {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          });

          if (resetPage && !('page' in updates)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  /** Toggle a sortable column: first click sorts descending, second ascending. */
  const toggleSort = useCallback(
    (column) => {
      const nextDirection = sort === column && direction === 'desc' ? 'asc' : 'desc';
      setParams({ sort: column, direction: nextDirection });
    },
    [sort, direction, setParams],
  );

  const setPage = useCallback((next) => setParams({ page: next }, { resetPage: false }), [setParams]);

  const clear = useCallback(() => setSearchParams({}, { replace: true }), [setSearchParams]);

  /** True when anything beyond paging is applied — drives the "Clear" control. */
  const hasFilters = useMemo(
    () => [...searchParams.keys()].some((key) => !['page', 'per_page', 'sort', 'direction'].includes(key)),
    [searchParams],
  );

  return { params, page, perPage, sort, direction, search, setParams, setPage, toggleSort, clear, hasFilters };
}
