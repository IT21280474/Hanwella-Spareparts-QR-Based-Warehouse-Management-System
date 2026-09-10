import { Inbox } from 'lucide-react';
import './EmptyState.css';

/**
 * Empty state. Says what is missing and what the user can do next — a bare
 * "no results" leaves someone stuck at a terminal with no way forward.
 */
export function EmptyState({ icon: Icon = Inbox, title, description, actions, compact = false }) {
  return (
    <div className={['empty', compact ? 'empty--compact' : ''].filter(Boolean).join(' ')}>
      <div className="empty__icon" aria-hidden="true">
        <Icon size={compact ? 18 : 22} strokeWidth={1.6} />
      </div>
      <p className="empty__title">{title}</p>
      {description ? <p className="empty__description">{description}</p> : null}
      {actions ? <div className="empty__actions">{actions}</div> : null}
    </div>
  );
}
