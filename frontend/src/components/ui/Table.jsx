import { ArrowDown, ArrowUp } from 'lucide-react';
import './Table.css';

/**
 * Horizontal scroll container. Wide tables scroll inside their own card rather
 * than pushing the page sideways.
 */
export function TableWrap({ minWidth = 940, className = '', children }) {
  return (
    <div className={['table-wrap', className].filter(Boolean).join(' ')}>
      <table className="table" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ align = 'left', width, className = '', children, ...rest }) {
  return (
    <th
      scope="col"
      className={['table__th', `is-${align}`, className].filter(Boolean).join(' ')}
      style={width ? { width } : undefined}
      {...rest}
    >
      {children}
    </th>
  );
}

/**
 * Sortable column header.
 *
 * `aria-sort` carries the state for assistive tech; the arrow carries it
 * visually. Clicking an inactive column sorts it descending first, which is
 * what a warehouse user wants from "stock" and "updated".
 */
export function SortableTh({ column, sort, direction, onSort, align = 'left', width, children }) {
  const active = sort === column;
  const Arrow = direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <Th align={align} width={width} aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="table__sort" onClick={() => onSort(column)}>
        {children}
        {active ? <Arrow size={12} strokeWidth={2.2} aria-hidden="true" /> : null}
      </button>
    </Th>
  );
}

export function Td({ align = 'left', nowrap = false, className = '', children, ...rest }) {
  return (
    <td
      className={['table__td', `is-${align}`, nowrap ? 'is-nowrap' : '', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </td>
  );
}

export function Tr({ className = '', children, ...rest }) {
  return (
    <tr className={['table__tr', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </tr>
  );
}
