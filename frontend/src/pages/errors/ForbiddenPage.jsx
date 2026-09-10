import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button, Card, EmptyState } from '@/components/ui';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function ForbiddenPage() {
  useDocumentTitle('Access denied');

  return (
    <Card>
      <EmptyState
        icon={ShieldAlert}
        title="You do not have access to this screen"
        description="Your role does not include this permission. If you need it, ask a warehouse administrator to grant it to your account."
        actions={
          <Link to="/dashboard">
            <Button>Back to dashboard</Button>
          </Link>
        }
      />
    </Card>
  );
}
