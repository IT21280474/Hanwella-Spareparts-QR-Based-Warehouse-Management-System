import { Component } from 'react';
import { Button } from '@/components/ui';
import './ErrorBoundary.css';

/**
 * Last line of defence against a white screen.
 *
 * A render-time crash is caught here and shown as a recoverable panel; the
 * details go to the console for a developer, never to the user as a stack
 * trace.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="boundary" role="alert">
        <div className="boundary__panel">
          <h1 className="boundary__title">Something went wrong on this screen</h1>
          <p className="boundary__text">
            The page stopped responding before it finished rendering. Reloading usually clears it. If it
            keeps happening, tell your administrator what you were doing at the time.
          </p>
          <div className="boundary__actions">
            <Button onClick={() => window.location.reload()}>Reload the page</Button>
            <Button variant="secondary" onClick={() => window.location.assign('/dashboard')}>
              Back to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
