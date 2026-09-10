import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { inventoryApi } from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';
import { Badge, Spinner } from '@/components/ui';
import { money } from '@/utils/format';
import { stockStatusLabel, stockStatusTone } from '@/utils/status';
import './GlobalSearch.css';

const RESULT_LIMIT = 6;

/**
 * Header search across part name, part number, SKU and QR identity.
 *
 * The query runs on the server against indexed columns — the browser never
 * downloads the catalogue to filter it locally.
 */
export function GlobalSearch() {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  const debounced = useDebounce(term);
  const enabled = debounced.trim().length >= 1;

  useOnClickOutside(containerRef, () => setOpen(false), open);

  const { data, isFetching, isError } = useQuery({
    queryKey: ['global-search', debounced],
    queryFn: () => inventoryApi.list({ search: debounced.trim(), per_page: RESULT_LIMIT }),
    enabled,
    staleTime: 15_000,
  });

  const results = enabled ? (data?.rows ?? []) : [];
  const showPanel = open && enabled;

  const openPart = (part) => {
    setOpen(false);
    setTerm('');
    navigate(`/inventory/${part.id}`);
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') setOpen(false);
    if (event.key === 'Enter' && results.length > 0) openPart(results[0]);
  };

  return (
    <div className="global-search" ref={containerRef}>
      <Search className="global-search__icon" size={16} strokeWidth={1.8} aria-hidden="true" />
      <input
        type="search"
        className="global-search__input"
        value={term}
        placeholder="Search part name, part no, SKU or QR ID"
        aria-label="Search inventory"
        aria-expanded={showPanel}
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {showPanel ? (
        <div className="global-search__panel" role="listbox" aria-label="Search results">
          <div className="global-search__panel-head">
            <span className="eyebrow">
              {isFetching
                ? 'Searching'
                : isError
                  ? 'Search unavailable'
                  : results.length
                    ? `${results.length} matching parts`
                    : 'No matches'}
            </span>
            {isFetching ? <Spinner size={12} tone="var(--color-muted-2)" /> : <span className="global-search__esc">esc</span>}
          </div>

          {results.map((part) => (
            <button key={part.id} type="button" className="global-search__result" onClick={() => openPart(part)}>
              <span className="global-search__code mono">{part.qr_code || '—'}</span>
              <span className="global-search__body">
                <span className="global-search__name">{part.name}</span>
                <span className="global-search__pn mono">{part.part_number}</span>
              </span>
              <span className="global-search__price num">{money(part.selling_price)}</span>
              <Badge tone={stockStatusTone(part)}>{stockStatusLabel(part)}</Badge>
            </button>
          ))}

          {!isFetching && !isError && results.length === 0 ? (
            <div className="global-search__empty">
              <p className="global-search__empty-title">No parts matched “{debounced}”</p>
              <p className="global-search__empty-sub">Try a part number, or scan the QR label on the bin.</p>
            </div>
          ) : null}

          {isError ? (
            <div className="global-search__empty">
              <p className="global-search__empty-title">Search could not run</p>
              <p className="global-search__empty-sub">The server did not respond. Try again in a moment.</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
