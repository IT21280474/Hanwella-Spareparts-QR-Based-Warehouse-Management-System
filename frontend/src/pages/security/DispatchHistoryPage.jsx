import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, History, X } from 'lucide-react';
import { useDispatchHistoryQuery } from '@/hooks/queries/useSecurity';
import { useTableParams } from '@/hooks/useTableParams';
import { useDebounce } from '@/hooks/useDebounce';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  PageHeader,
  Pagination,
  SearchInput,
  SkeletonRows,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@/components/ui';
import { formatDate, formatTime, money, number } from '@/utils/format';
import './DispatchHistoryPage.css';

/**
 * Every order released at the gate, newest first.
 *
 * Read-only by design: the API has no route to edit or delete a dispatch
 * record, for Security or anyone else. Each row is the snapshot taken when
 * the dispatch was confirmed.
 */
export default function DispatchHistoryPage() {
  useDocumentTitle('Dispatch history');
  const navigate = useNavigate();

  const { params, page, search, setParams, setPage, clear, hasFilters } = useTableParams();

  const [term, setTerm] = useState(search);
  const debouncedTerm = useDebounce(term);

  useEffect(() => {
    if (debouncedTerm !== search) setParams({ search: debouncedTerm });
  }, [debouncedTerm, search, setParams]);

  const query = {
    search: params.search || '',
    from: params.from || '',
    to: params.to || '',
    page,
    per_page: params.per_page,
  };

  const { data, isLoading, isFetching, isError, error, refetch } = useDispatchHistoryQuery(query);
  const rows = data?.rows ?? [];
  const meta = data?.meta;

  const resetAll = () => {
    setTerm('');
    clear();
  };

  const open = (dispatch) => navigate(`/security/orders/${dispatch.order_id}`);

  return (
    <div className="dispatches">
      <PageHeader
        title="Dispatch history"
        description={
          meta ? `${number(meta.total)} ${meta.total === 1 ? 'order' : 'orders'} released at the gate` : 'Every order released at the gate'
        }
      />

      <Card>
        <div className="dispatches__toolbar">
          <SearchInput
            value={term}
            onChange={setTerm}
            placeholder="Search order / bill no, customer, officer or DSP number"
            label="Search dispatch history"
            size="md"
          />

          <div className="dispatches__dates" role="group" aria-label="Dispatched between">
            <Input
              size="sm"
              type="date"
              value={params.from || ''}
              max={params.to || undefined}
              onChange={(event) => setParams({ from: event.target.value })}
              aria-label="Dispatched from date"
            />
            <span className="dispatches__dash" aria-hidden="true">
              –
            </span>
            <Input
              size="sm"
              type="date"
              value={params.to || ''}
              min={params.from || undefined}
              onChange={(event) => setParams({ to: event.target.value })}
              aria-label="Dispatched to date"
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
            <TableWrap minWidth={1080}>
              <thead>
                <tr>
                  <Th width={108}>Dispatch ID</Th>
                  <Th width={132}>Order / bill no</Th>
                  <Th>Customer</Th>
                  <Th align="right" width={60}>
                    Items
                  </Th>
                  <Th align="right" width={60}>
                    Qty
                  </Th>
                  <Th align="right" width={112}>
                    Order value
                  </Th>
                  <Th width={136}>Dispatched by</Th>
                  <Th width={104}>Date</Th>
                  <Th width={64}>Time</Th>
                  <Th width={108}>Status</Th>
                  <Th align="right" width={44}>
                    <span className="sr-only">Open</span>
                  </Th>
                </tr>
              </thead>

              {isLoading ? (
                <SkeletonRows rows={8} columns={11} />
              ) : (
                <tbody className={isFetching ? 'is-refreshing' : ''}>
                  {rows.map((dispatch) => (
                    <Tr key={dispatch.id}>
                      <Td nowrap className="mono dispatches__id">
                        {dispatch.dispatch_no}
                      </Td>

                      <Td nowrap>
                        <button type="button" className="dispatches__no mono" onClick={() => open(dispatch)}>
                          {dispatch.order_no}
                        </button>
                      </Td>

                      <Td>
                        <span className="dispatches__customer">{dispatch.customer_name}</span>
                        {dispatch.customer_phone ? (
                          <span className="dispatches__phone mono">{dispatch.customer_phone}</span>
                        ) : null}
                      </Td>

                      <Td align="right" nowrap className="num">
                        {number(dispatch.items_count)}
                      </Td>

                      <Td align="right" nowrap className="num dispatches__qty">
                        {number(dispatch.total_quantity)}
                      </Td>

                      <Td align="right" nowrap className="num">
                        {money(dispatch.total)}
                      </Td>

                      <Td nowrap>{dispatch.dispatched_by?.name ?? '—'}</Td>

                      <Td nowrap className="dispatches__when">
                        {formatDate(dispatch.dispatched_at)}
                      </Td>

                      <Td nowrap className="dispatches__when mono">
                        {formatTime(dispatch.dispatched_at)}
                      </Td>

                      <Td nowrap>
                        <Badge tone="info" dot>
                          DISPATCHED
                        </Badge>
                      </Td>

                      <Td align="right">
                        <IconButton
                          icon={ChevronRight}
                          label={`Open ${dispatch.order_no}`}
                          onClick={() => open(dispatch)}
                        />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              )}
            </TableWrap>

            {!isLoading && rows.length === 0 ? (
              <EmptyState
                icon={History}
                title={hasFilters ? 'No dispatches match' : 'Nothing dispatched yet'}
                description={
                  hasFilters
                    ? 'No released order matched the current search and dates.'
                    : 'Every order released at the gate will be recorded here.'
                }
                actions={hasFilters ? <Button onClick={resetAll}>Clear filters</Button> : null}
              />
            ) : null}

            <Pagination meta={meta} onPage={setPage} unit="dispatches" />
          </>
        )}
      </Card>
    </div>
  );
}
