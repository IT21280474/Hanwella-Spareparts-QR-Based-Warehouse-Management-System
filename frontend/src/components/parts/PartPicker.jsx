import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { inventoryApi } from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';
import { Badge, IconButton, QrImage, Spinner } from '@/components/ui';
import { money, number } from '@/utils/format';
import { stockStatusLabel, stockStatusTone } from '@/utils/status';
import './PartPicker.css';

const RESULT_LIMIT = 7;

/**
 * Type-ahead part selector shared by stock in, stock out and the counter sale.
 *
 * Matching runs on the server across name, part number, SKU and QR identity, so
 * a scanner gun typing a code into the box resolves the same way a human search
 * does. Arrow keys and Enter work throughout — a warehouse terminal is often
 * driven without a mouse.
 */
export function PartPicker({
  value = null,
  onSelect,
  onClear,
  label = 'Spare part',
  placeholder = 'Search name, part no or scan a QR label',
  autoFocus = false,
  disabled = false,
  excludeIds = [],
}) {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef(null);

  const debounced = useDebounce(term);
  const enabled = !value && debounced.trim().length >= 1;

  useOnClickOutside(containerRef, () => setOpen(false), open);

  const { data, isFetching, isError } = useQuery({
    queryKey: ['part-picker', debounced],
    queryFn: () => inventoryApi.list({ search: debounced.trim(), per_page: RESULT_LIMIT }),
    enabled,
    staleTime: 15_000,
  });

  const results = (enabled ? (data?.rows ?? []) : []).filter((part) => !excludeIds.includes(part.id));

  // A fresh result set invalidates the previous highlight position.
  useEffect(() => setHighlight(0), [debounced]);

  const choose = (part) => {
    if (!part) return;
    onSelect(part);
    setTerm('');
    setOpen(false);
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (results.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(results[highlight]);
    }
  };

  if (value) {
    return (
      <div className="picker">
        <span className="picker__label">{label}</span>
        <div className="picker__chosen">
          <QrImage code={value.qr_code} size={38} />
          <div className="picker__chosen-text">
            <p className="picker__chosen-name">{value.name}</p>
            <p className="picker__chosen-meta">
              <span className="mono">{value.part_number}</span>
              <span className="picker__sep" aria-hidden="true">
                |
              </span>
              <span className="mono">{value.qr_code || 'No QR'}</span>
              <span className="picker__sep" aria-hidden="true">
                |
              </span>
              <span>{number(value.quantity)} on hand</span>
            </p>
          </div>
          <Badge tone={stockStatusTone(value)} dot>
            {stockStatusLabel(value)}
          </Badge>
          {onClear ? <IconButton icon={X} label="Choose a different part" onClick={onClear} /> : null}
        </div>
      </div>
    );
  }

  const showPanel = open && enabled;

  return (
    <div className="picker" ref={containerRef}>
      <span className="picker__label" id="picker-label">
        {label}
      </span>

      <div className="picker__control">
        <Search className="picker__icon" size={15} strokeWidth={1.8} aria-hidden="true" />
        <input
          type="search"
          className="picker__input"
          value={term}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="picker-results"
          aria-labelledby="picker-label"
          aria-autocomplete="list"
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {isFetching ? <Spinner size={13} tone="var(--color-muted-2)" /> : null}
      </div>

      {showPanel ? (
        <div className="picker__panel" id="picker-results" role="listbox" aria-label="Matching spare parts">
          {results.map((part, index) => (
            <button
              key={part.id}
              type="button"
              role="option"
              aria-selected={index === highlight}
              className={['picker__result', index === highlight ? 'is-active' : ''].filter(Boolean).join(' ')}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => choose(part)}
            >
              <QrImage code={part.qr_code} size={28} />
              <span className="picker__result-body">
                <span className="picker__result-name">{part.name}</span>
                <span className="picker__result-meta mono">
                  {part.part_number} · {part.qr_code || 'No QR'}
                </span>
              </span>
              <span className="picker__result-price num">{money(part.selling_price)}</span>
              <Badge tone={stockStatusTone(part)} size="sm">
                {number(part.quantity)}
              </Badge>
            </button>
          ))}

          {!isFetching && !isError && results.length === 0 ? (
            <p className="picker__empty">
              No part matched “{debounced}”. Try the part number, or scan the QR label on the bin.
            </p>
          ) : null}

          {isError ? <p className="picker__empty">Search could not run. Check the connection and try again.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
