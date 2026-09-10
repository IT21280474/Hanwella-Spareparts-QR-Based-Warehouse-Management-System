import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button, Card, EmptyState } from '@/components/ui';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');

  return (
    <Card>
      <EmptyState
        icon={Compass}
        title="That page does not exist"
        description="The link may be out of date, or the record it pointed to has been removed."
        actions={
          <>
            <Link to="/dashboard">
              <Button>Back to dashboard</Button>
            </Link>
            <Link to="/inventory">
              <Button variant="secondary">Open inventory</Button>
            </Link>
          </>
        }
      />
    </Card>
  );
}
