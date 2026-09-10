import './Pagination.css';

/** Windowed page numbers, five at a time, centred on the current page. */
function pageWindow(current, last, size = 5) {
  const start = Math.max(1, Math.min(current - Math.floor(size / 2), last - size + 1));
  const pages = [];
  for (let page = start; page < start + size && page <= last; page += 1) pages.push(page);
  return pages;
}

/**
 * Pagination footer.
 *
 * Filters live in the URL, so paging preserves them for free — this component
 * only moves the page number.
 */
export function Pagination({ meta, onPage, unit = 'records' }) {
  if (!meta) return null;

  const { current_page: current = 1, last_page: last = 1, total = 0, from, to } = meta;

  const summary = total
    ? `Showing ${from ?? 0}-${to ?? 0} of ${total.toLocaleString('en-US')} ${unit}`
    : `No ${unit} to show`;

  return (
    <div className="pagination">
      <span className="pagination__summary">{summary}</span>

      {last > 1 ? (
        <nav className="pagination__pages" aria-label="Pagination">
          <button
            type="button"
            className="pagination__button"
            onClick={() => onPage(current - 1)}
            disabled={current <= 1}
          >
            Previous
          </button>

          {pageWindow(current, last).map((page) => (
            <button
              key={page}
              type="button"
              className={['pagination__page', page === current ? 'is-active' : ''].filter(Boolean).join(' ')}
              onClick={() => onPage(page)}
              aria-current={page === current ? 'page' : undefined}
            >
              {page}
            </button>
          ))}

          <button
            type="button"
            className="pagination__button"
            onClick={() => onPage(current + 1)}
            disabled={current >= last}
          >
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}
