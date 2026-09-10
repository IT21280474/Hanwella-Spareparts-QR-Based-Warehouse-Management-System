import { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ScrollText, X } from 'lucide-react';
import { auditLogsApi } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';
import { useTableParams } from '@/hooks/useTableParams';
import { useDebounce } from '@/hooks/useDebounce';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  SkeletonRows,
  SortableTh,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@/components/ui';
import { formatDateTime, initialsOf } from '@/utils/format';
import './AuditLogPage.css';

/** Action families, coarse enough to be a useful filter. */
const ACTION_OPTIONS = [
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'deleted', label: 'Deleted' },
  { value: 'stock', label: 'Stock changes' },
  { value: 'auth', label: 'Sign in / out' },
];

const ACTION_TONE = {
  created: 'success',
  updated: 'info',
  deleted: 'danger',
  stock: 'warning',
  auth: 'neutral',
};

/**
 * The audit trail.
 *
 * Read-only by design — there is no edit and no delete on this screen, because
 * a log that can be corrected is not a log. Filtering and paging run on the
 * server so the whole trail never has to reach the browser.
 */
export default function AuditLogPage() {
  useDocumentTitle('Audit log');

  const { params, page, sort, direction, search, setParams, setPage, toggleSort, clear, hasFilters } = useTableParams({
    sort: 'created_at',
    direction: 'desc',
  });

  const [term, setTerm] = useState(search);
  const debouncedTerm = useDebounce(term);

  useEffect(() => {
    if (debouncedTerm !== search) setParams({ search: debouncedTerm });
  }, [debouncedTerm, search, setParams]);

  const query = {
    search: params.search || '',
    action: params.action || '',
    from: params.from || '',
    to: params.to || '',
    sort,
    direction,
    page,
    per_page: params.per_page,
  };

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.auditLogs(query),
    queryFn: () => auditLogsApi.list(query),
    placeholderData: keepPreviousData,
  });

  const rows = data?.rows ?? [];
  const meta = data?.meta;

  const resetAll = () => {
    setTerm('');
    clear();
  };

  return (
    <div className="audit">
      <PageHeader
        title="Audit log"
        description="Who changed what, and when. Entries are written by the server and cannot be edited or removed from here."
      />

      <Card>
        <div className="audit__toolbar">
          <SearchInput
            value={term}
            onChange={setTerm}
            placeholder="Search user, record or description"
            label="Search the audit log"
          />

          <Select
            size="sm"
            value={params.action || ''}
            onChange={(event) => setParams({ action: event.target.value })}
            options={ACTION_OPTIONS}
            placeholder="All actions"
            aria-label="Action"
          />

          <div className="audit__dates">
            <Input
              size="sm"
              type="date"
              value={params.from || ''}
              onChange={(event) => setParams({ from: event.target.value })}
              aria-label="From date"
            />
            <span className="audit__dash" aria-hidden="true">
              –
            </span>
            <Input
              size="sm"
              type="date"
              value={params.to || ''}
              onChange={(event) => setParams({ to: event.target.value })}
              aria-label="To date"
            />
          </div>

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
            <TableWrap minWidth={940}>
              <thead>
                <tr>
                  <SortableTh column="created_at" sort={sort} direction={direction} onSort={toggleSort} width={160}>
                    When
                  </SortableTh>
                  <Th width={190}>Who</Th>
                  <Th width={120}>Action</Th>
                  <Th width={170}>Record</Th>
                  <Th>What changed</Th>
                  <Th width={120}>From</Th>
                </tr>
              </thead>

              {isLoading ? (
                <SkeletonRows rows={12} columns={6} />
              ) : (
                <tbody className={isFetching ? 'is-refreshing' : ''}>
                  {rows.map((entry) => (
                    <Tr key={entry.id}>
                      <Td nowrap className="audit__when">
                        {formatDateTime(entry.created_at)}
                      </Td>

                      <Td>
                        <div className="audit__who">
                          <span className="audit__avatar" aria-hidden="true">
                            {entry.user?.name ? initialsOf(entry.user.name) : '—'}
                          </span>
                          <span className="audit__who-text">
                            <span className="audit__who-name">{entry.user?.name || 'System'}</span>
                            {entry.user?.role ? <span className="audit__who-role">{entry.user.role}</span> : null}
                          </span>
                        </div>
                      </Td>

                      <Td nowrap>
                        <Badge tone={ACTION_TONE[entry.action_group] || 'neutral'} size="sm">
                          {entry.action}
                        </Badge>
                      </Td>

                      <Td nowrap className="audit__record">
                        <span className="audit__record-type">{entry.subject_type || '—'}</span>
                        {entry.subject_label ? (
                          <span className="audit__record-label mono">{entry.subject_label}</span>
                        ) : null}
                      </Td>

                      <Td className="audit__description">{entry.description || '—'}</Td>

                      <Td nowrap className="audit__ip mono">
                        {entry.ip_address || '—'}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              )}
            </TableWrap>

            {!isLoading && rows.length === 0 ? (
              <EmptyState
                icon={ScrollText}
                title="Nothing recorded in this view"
                description="No entry matched the current search, action and date range."
                actions={hasFilters ? <Button onClick={resetAll}>Clear filters</Button> : null}
              />
            ) : null}

            <Pagination meta={meta} onPage={setPage} unit="entries" />
          </>
        )}
      </Card>
    </div>
  );
}
