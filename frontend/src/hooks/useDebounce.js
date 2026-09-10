import { useEffect, useState } from 'react';
import { SEARCH_DEBOUNCE_MS } from '@/constants';

/**
 * Delay a fast-changing value so a search box issues one request per pause
 * rather than one per keystroke.
 */
export function useDebounce(value, delay = SEARCH_DEBOUNCE_MS) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
