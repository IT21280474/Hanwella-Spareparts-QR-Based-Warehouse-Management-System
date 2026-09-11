import { useEffect, useState } from 'react';
import { Pencil, Power, ScrollText, UserPlus, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSetUserActive, useUsersQuery } from '@/hooks/queries/useUsers';
import { useTableParams } from '@/hooks/useTableParams';
import { useDebounce } from '@/hooks/useDebounce';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/store/toastStore';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  Pagination,
  SearchInput,
  SegmentedControl,
  SkeletonRows,
  SortableTh,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@/components/ui';
import { UserFormModal } from './UserFormModal';
import { initialsOf, relativeDateTime } from '@/utils/format';
import './UsersPage.css';

const STATE_TABS = [
  { value: 'All', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Deactivated' },
];

const ROLE_TONE = {
  ADMIN: 'danger',
  MANAGER: 'info',
  WAREHOUSE_STAFF: 'success',
  SALES_PERSON: 'warning',
  SECURITY: 'info',
  VIEWER: 'neutral',
};

/**
 * Warehouse accounts.
 *
 * Accounts are deactivated, never deleted — every movement, adjustment and
 * order names the person who made it, and that trail has to keep pointing at a
 * real record.
 */
export default function UsersPage() {
  useDocumentTitle('Users');
  const { user: currentUser } = useAuth();

  const { params, page, sort, direction, search, setParams, setPage, toggleSort, clear, hasFilters } = useTableParams({
    sort: 'name',
    direction: 'asc',
  });

  const [term, setTerm] = useState(search);
  const debouncedTerm = useDebounce(term);
  const [editing, setEditing] = useState(null); // user | 'new' | null
  const [toggling, setToggling] = useState(null);

  useEffect(() => {
    if (debouncedTerm !== search) setParams({ search: debouncedTerm });
  }, [debouncedTerm, search, setParams]);

  const query = {
    search: params.search || '',
    state: params.state || '',
    role: params.role || '',
    sort,
    direction,
    page,
    per_page: params.per_page,
  };

  const { data, isLoading, isFetching, isError, error, refetch } = useUsersQuery(query);
  const setActive = useSetUserActive();

  const rows = data?.rows ?? [];
  const meta = data?.meta;

  const resetAll = () => {
    setTerm('');
    clear();
  };

  const confirmToggle = () => {
    const target = toggling;
    setActive.mutate(
      { id: target.id, isActive: !target.is_active },
      {
        onSuccess: ({ message }) => {
          toast.success(
            target.is_active ? 'Account deactivated' : 'Account reactivated',
            message || target.name,
          );
          setToggling(null);
        },
        onError: (toggleError) => {
          setToggling(null);
          toast.fromError(toggleError, 'Could not change the account');
        },
      },
    );
  };

  return (
    <div className="users">
      <PageHeader
        title="Users"
        description="Who can sign in, and what each of them is allowed to do."
        actions={
          <>
            <Link to="/audit-logs">
              <Button variant="secondary" icon={ScrollText}>
                Audit log
              </Button>
            </Link>
            <Button icon={UserPlus} onClick={() => setEditing('new')}>
              New account
            </Button>
          </>
        }
      />

      <Card>
        <div className="users__toolbar">
          <SearchInput value={term} onChange={setTerm} placeholder="Search name or email" label="Search users" />

          <SegmentedControl
            options={STATE_TABS}
            value={params.state || 'All'}
            onChange={(value) => setParams({ state: value })}
            label="Account state"
          />

          {hasFilters ? (
            <Button variant="secondary" size="sm" icon={X} onClick={resetAll}>
              Clear
            </Button>
          ) : null}
        </div>

        {isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <>
            <TableWrap minWidth={880}>
              <thead>
                <tr>
                  <SortableTh column="name" sort={sort} direction={direction} onSort={toggleSort}>
                    Person
                  </SortableTh>
                  <Th width={150}>Role</Th>
                  <Th width={110}>State</Th>
                  <SortableTh column="last_login_at" sort={sort} direction={direction} onSort={toggleSort} width={150}>
                    Last signed in
                  </SortableTh>
                  <Th width={130}>Added</Th>
                  <Th align="right" width={92}>
                    Actions
                  </Th>
                </tr>
              </thead>

              {isLoading ? (
                <SkeletonRows rows={8} columns={6} />
              ) : (
                <tbody className={isFetching ? 'is-refreshing' : ''}>
                  {rows.map((person) => (
                    <Tr key={person.id}>
                      <Td>
                        <div className="users__person">
                          <span className="users__avatar" aria-hidden="true">
                            {person.initials || initialsOf(person.name)}
                          </span>
                          <div className="users__person-text">
                            <span className="users__name">
                              {person.name}
                              {person.id === currentUser?.id ? <span className="users__you">you</span> : null}
                            </span>
                            <span className="users__email">{person.email}</span>
                          </div>
                        </div>
                      </Td>

                      <Td nowrap>
                        <Badge tone={ROLE_TONE[person.role?.slug] || 'neutral'}>{person.role?.name || '—'}</Badge>
                      </Td>

                      <Td nowrap>
                        <Badge tone={person.is_active ? 'success' : 'neutral'} dot>
                          {person.is_active ? 'Active' : 'Deactivated'}
                        </Badge>
                      </Td>

                      <Td nowrap className="users__meta">
                        {person.last_login_at ? relativeDateTime(person.last_login_at) : 'Never'}
                      </Td>

                      <Td nowrap className="users__meta">
                        {relativeDateTime(person.created_at)}
                      </Td>

                      <Td>
                        <div className="table__row-actions">
                          <IconButton icon={Pencil} label={`Edit ${person.name}`} onClick={() => setEditing(person)} />
                          <IconButton
                            icon={Power}
                            label={person.is_active ? `Deactivate ${person.name}` : `Reactivate ${person.name}`}
                            variant={person.is_active ? 'danger' : 'outline'}
                            onClick={() => setToggling(person)}
                            disabled={person.id === currentUser?.id}
                          />
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              )}
            </TableWrap>

            {!isLoading && rows.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No accounts match this view"
                description="Nothing found for the current search and state filter."
                actions={
                  <>
                    {hasFilters ? <Button onClick={resetAll}>Clear filters</Button> : null}
                    <Button variant="secondary" icon={UserPlus} onClick={() => setEditing('new')}>
                      New account
                    </Button>
                  </>
                }
              />
            ) : null}

            <Pagination meta={meta} onPage={setPage} unit="accounts" />
          </>
        )}
      </Card>

      <UserFormModal
        open={!!editing}
        user={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
      />

      <ConfirmDialog
        open={!!toggling}
        onClose={() => setToggling(null)}
        onConfirm={confirmToggle}
        loading={setActive.isPending}
        tone={toggling?.is_active ? 'danger' : 'primary'}
        title={toggling?.is_active ? 'Deactivate this account?' : 'Reactivate this account?'}
        confirmLabel={toggling?.is_active ? 'Deactivate' : 'Reactivate'}
      >
        <p className="users__confirm">
          {toggling?.is_active ? (
            <>
              <strong>{toggling?.name}</strong> will no longer be able to sign in. Their movements, adjustments and
              orders stay on record — the account is disabled, not removed.
            </>
          ) : (
            <>
              <strong>{toggling?.name}</strong> will be able to sign in again with their existing password and role.
            </>
          )}
        </p>
      </ConfirmDialog>
    </div>
  );
}
