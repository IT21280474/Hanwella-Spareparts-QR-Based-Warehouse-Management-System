import './PageHeader.css';

/** Page title block: heading, optional description, trailing actions. */
export function PageHeader({ title, description, actions, className = '' }) {
  return (
    <header className={['page-header', className].filter(Boolean).join(' ')}>
      <div className="page-header__text">
        <h1 className="page-header__title">{title}</h1>
        {description ? <p className="page-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
