import './Card.css';

/** White surface, 1px rule, 9px radius — the container every panel uses. */
export function Card({ as: Tag = 'section', padded = false, flush = false, className = '', children, ...rest }) {
  return (
    <Tag
      className={['card', padded ? 'card--padded' : '', flush ? 'card--flush' : '', className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Title row with optional description and trailing actions. */
export function CardHeader({ title, subtitle, actions, eyebrow, className = '', children }) {
  return (
    <header className={['card__header', className].filter(Boolean).join(' ')}>
      <div className="card__heading">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        {title ? <h2 className="card__title">{title}</h2> : null}
        {subtitle ? <p className="card__subtitle">{subtitle}</p> : null}
        {children}
      </div>
      {actions ? <div className="card__actions">{actions}</div> : null}
    </header>
  );
}

export function CardBody({ className = '', children, ...rest }) {
  return (
    <div className={['card__body', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children, ...rest }) {
  return (
    <footer className={['card__footer', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </footer>
  );
}
