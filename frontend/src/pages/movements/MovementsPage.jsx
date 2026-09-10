import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, X } from 'lucide-react';
import { useMovementsQuery } from '@/hooks/queries/useMovements';
import { useTableParams } from '@/hooks/useTableParams';
import { useDebounce } from '@/hooks/useDebounce';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { MOVEMENT_TYPE, MOVEMENT_TYPE_LABEL } from '@/constants/options';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  PageHeader,
  SearchInput,
  SkeletonRows,
  SortableTh,
  TableWrap,
  Tabs,
  Td,
  Th,
  Tr,
} from '@/components/ui';
import { formatDateTime, number, signed } from '@/utils/format';
import { deltaTone } from '@/utils/status';
import './MovementsPage.css';

/** Filter tabs, matching the movement types the reference exposes. */
const TYPE_TABS = [
  { value: 'All', label: 'All' },
  { value: MOVEMENT_TYPE.SALE, label: 'Sales' },
  { value: MOVEMENT_TYPE.STOCK_IN, label: 'Received' },
  { value: MOVEMENT_TYPE.STOCK_OUT, label: 'Issued' },
  { value: MOVEMENT_TYPE.ADJUSTMENT, label: 'Adjustments' },
  { value: MOVEMENT_TYPE.RETURN, label: 'Returns' },
];

const TYPE_TONE = {
  [MOVEMENT_TYPE.STOCK_IN]: 'success',
  [MOVEMENT_TYPE.RETURN]: 'success',
  [MOVEMENT_TYPE.SALE]: 'info',
  [MOVEMENT_TYPE.STOCK_OUT]: 'warning',
  [MOVEMENT_TYPE.ADJUSTMENT]: 'neutral',
  [MOVEMENT_TYPE.TRANSFER]: 'neutral',
};

/**
 * The stock ledger.
 *
 * Every row is a fact that was written once and is never edited — a correction
 * appends a compensating movement rather than rewriting history. The balance
 * column shows before and after so a discrepancy can be traced to the entry
 * that caused it.
 */
export default function MovementsPage() {
  useDocumentTitle('Stock movement');
  const navigate = useNavigate();
  const { can } = usePermission();

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
    type: params.type || '',
    part: params.part || '',
    from: params.from || '',
    to: params.to || '',
    sort,
    direction,
    page,
    per_page: params.per_page,
  };

  const { data, isLoading, isFetching, isError, error, refetch } = useMovementsQuery(query);
  const rows = data?.rows ?? [];
  const meta = data?.meta;

  const typeCounts = meta?.type_counts;
  const tabs = TYPE_TABS.map((tab) => ({
    ...tab,
    count: typeCounts ? (tab.value === 'All' ? typeCounts.all : typeCounts[tab.value]) : undefined,
  }));

  const resetAll = () => {
    setTerm('');
    clear();
  };

  return (
    <div className="movements">
      <PageHeader
        title="Stock movement"
        description={
          meta
            ? `${number(meta.total)} entries · ${number(meta.units_in ?? 0)} units in · ${number(meta.units_out ?? 0)} units out`
            : 'Every receipt, issue, sale and correction, in the order it happened'
        }
        actions={
          <>
            {can(PERMISSIONS.CREATE_STOCK_IN) ? (
              <Link to="/stock/in">
                <Button variant="secondary" icon={ArrowDownToLine}>
                  Stock in
                </Button>
              </Link>
            ) : null}
            {can(PERMISSIONS.CREATE_STOCK_OUT) ? (
              <Link to="/stock/out">
                <Button variant="secondary" icon={ArrowUpFromLine}>
                  Stock out
                </Button>
              </Link>
            ) : null}
          </>
        }
      />

      <Card>
        <Tabs
          tabs={tabs}
          value={params.type || 'All'}
          onChange={(value) => setParams({ type: value })}
          label="Movement type"
          className="movements__tabs"
        />

        <div className="movements__toolbar">
          <SearchInput
            value={term}
            onChange={setTerm}
            placeholder="Search part, QR ID or reference"
            label="Search movements"
          />

          <div className="movements__dates">
            <Input
              size="sm"
              type="date"
              value={params.from || ''}
              onChange={(event) => setParams({ from: event.target.value })}
              aria-label="From date"
            />
            <span className="movements__dash" aria-hidden="true">
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
            <TableWrap minWidth={980}>
              <thead>
                <tr>
                  <SortableTh column="created_at" sort={sort} direction={direction} onSort={toggleSort} width={150}>
                    When
                  </SortableTh>
                  <Th>Spare part</Th>
                  <Th width={130}>Type</Th>
                  <SortableTh column="quantity" sort={sort} direction={direction} onSort={toggleSort} align="right" width={92}>
                    Change
                  </SortableTh>
                  <Th align="right" width={124}>
                    Balance
                  </Th>
                  <Th>Reference</Th>
                  <Th width={140}>By</Th>
                </tr>
              </thead>

              {isLoading ? (
                <SkeletonRows rows={10} columns={7} />
              ) : (
                <tbody className={isFetching ? 'is-refreshing' : ''}>
                  {rows.map((movement) => (
                    <Tr key={movement.id}>
                      <Td nowrap className="movements__when">
                        {formatDateTime(movement.created_at)}
                      </Td>

                      <Td>
                        <button
                          type="button"
                          className="table__primary"
                          onClick={() => movement.part?.id && navigate(`/inventory/${movement.part.id}`)}
                          disabled={!movement.part?.id}
                        >
                          <span className="table__primary-name">{movement.part?.name || 'Removed part'}</span>
                          <span className="table__primary-meta">
                            <span>{movement.part_number || '—'}</span>
                            <span className="sep">|</span>
                            <span className="code">{movement.qr_code || 'No QR'}</span>
                          </span>
                        </button>
                      </Td>

                      <Td nowrap>
                        <Badge tone={TYPE_TONE[movement.type] || 'neutral'}>
                          {MOVEMENT_TYPE_LABEL[movement.type] || movement.type}
                        </Badge>
                      </Td>

                      <Td align="right" nowrap>
                        <span className="movements__delta num" data-tone={deltaTone(movement.quantity)}>
                          {signed(movement.quantity)}
                        </span>
                      </Td>

                      <Td align="right" nowrap className="num movements__balance">
                        {number(movement.quantity_before)} → {number(movement.quantity_after)}
                      </Td>

                      <Td className="movements__reference">
                        {movement.reference_no ? <span className="mono">{movement.reference_no}</span> : null}
                        {movement.reason ? <span className="movements__reason">{movement.reason}</span> : null}
                        {!movement.reference_no && !movement.reason ? <span>—</span> : null}
                      </Td>

                      <Td nowrap className="movements__when">
                        {movement.user?.name || 'System'}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              )}
            </TableWrap>

            {!isLoading && rows.length === 0 ? (
              <EmptyState
                icon={ArrowLeftRight}
                title="No movement in this view"
                description="Nothing was recorded for the selected type, dates and search. Widen the range, or record a receipt to start the trail."
                actions={
                  <>
                    {hasFilters ? <Button onClick={resetAll}>Clear filters</Button> : null}
                    {can(PERMISSIONS.CREATE_STOCK_IN) ? (
                      <Link to="/stock/in">
                        <Button variant="secondary" icon={ArrowDownToLine}>
                          Record a receipt
                        </Button>
                      </Link>
                    ) : null}
                  </>
                }
              />
            ) : null}

            <Pagination meta={meta} onPage={setPage} unit="movements" />
          </>
        )}
      </Card>
    </div>
  );
}
