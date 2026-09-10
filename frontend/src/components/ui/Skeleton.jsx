import './Skeleton.css';

/** Shimmering placeholder used while a region loads. */
export function Skeleton({ width = '100%', height = 14, radius = 'var(--radius-sm)', className = '' }) {
  return (
    <span
      className={['skeleton', className].filter(Boolean).join(' ')}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

/** Placeholder table body — keeps column widths stable while rows load. */
export function SkeletonRows({ rows = 6, columns = 5 }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="skeleton-row">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <td key={columnIndex}>
              <Skeleton width={columnIndex === 0 ? '60%' : '80%'} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
