import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, FileSpreadsheet, Package, Plus, ScanLine, SlidersHorizontal, X } from 'lucide-react';
import { useInventoryQuery } from '@/hooks/queries/useInventory';
import { useCategoriesQuery, toSelectOptions } from '@/hooks/queries/useReference';
import { useTableParams } from '@/hooks/useTableParams';
import { useDebounce } from '@/hooks/useDebounce';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { usePermission } from '@/hooks/usePermission';
import { useCartStore } from '@/store/cartStore';
import { toast } from '@/store/toastStore';
import { PERMISSIONS } from '@/constants/permissions';
import { STOCK_STATUS_TABS } from '@/constants/options';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  Pagination,
  QrImage,
  SearchInput,
  SegmentedControl,
  Select,
  SkeletonRows,
  SortableTh,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@/components/ui';
import { AdjustStockModal } from '@/components/inventory/AdjustStockModal';
import { money, number, relativeDays } from '@/utils/format';
import { stockQuantityTone, stockStatusLabel, stockStatusTone } from '@/utils/status';
import './InventoryListPage.css';

/**
 * The inventory table.
 *
 * Search, filters, sorting and paging all run on the server and live in the
 * URL — the browser never holds the catalogue in memory to filter it locally.
 */
export default function InventoryListPage() {
  useDocumentTitle('Inventory');
  const navigate = useNavigate();
  const { can } = usePermission();
  const addToCart = useCartStore((state) => state.add);

  const { params, page, sort, direction, search, setParams, setPage, toggleSort, clear, hasFilters } = useTableParams({
    sort: 'updated_at',
    direction: 'desc',
  });

  const [term, setTerm] = useState(search);
  const debouncedTerm = useDebounce(term);
  const [adjusting, setAdjusting] = useState(null);

  // Keep the URL in step with the debounced box, not every keystroke.
  useEffect(() => {
    if (debouncedTerm !== search) setParams({ search: debouncedTerm });
  }, [debouncedTerm, search, setParams]);

  // A filter cleared from elsewhere (the "Clear" button) must reset the box.
  useEffect(() => {
    if (!search && !debouncedTerm) return;
    if (search !== debouncedTerm && search === '') setTerm('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data: categories } = useCategoriesQuery();

  const query = {
    search: params.search || '',
    status: params.status || '',
    category: params.category || '',
    supplier: params.supplier || '',
    sort,
    direction,
    page,
    per_page: params.per_page,
  };

  const { data, isLoading, isFetching, isError, error, refetch } = useInventoryQuery(query);
  const rows = data?.rows ?? [];
  const meta = data?.meta;

  const statusCounts = data?.meta?.status_counts;
  const statusTabs = STOCK_STATUS_TABS.map((tab) => ({
    ...tab,
    count: statusCounts ? (tab.value === 'All' ? statusCounts.all : statusCounts[tab.value]) : undefined,
  }));

  const onAddToCart = (part) => {
    if (addToCart(part)) {
      toast.success('Added to order', `${part.name.slice(0, 42)} × 1`);
    } else {
      toast.error('Out of stock', `${part.name} has no units on hand.`);
    }
  };

  return (
    <div className="inventory">
      <div className="inventory__head">
        <div>
          <h1 className="inventory__title">Spare parts</h1>
          <p className="inventory__summary">
            {meta
              ? `${number(meta.total)} parts · ${number(meta.units_on_hand ?? 0)} units on hand · ${number(
                  meta.needs_attention ?? 0,
                )} need attention`
              : 'Loading inventory…'}
          </p>
        </div>

        <div className="inventory__actions">
          {can(PERMISSIONS.CREATE_INVENTORY) ? (
            <Link to="/imports">
              <Button variant="secondary" icon={FileSpreadsheet}>
                Bulk upload
              </Button>
            </Link>
          ) : null}
          {can(PERMISSIONS.CREATE_INVENTORY) ? (
            <Link to="/inventory/new">
              <Button icon={Plus}>Add spare part</Button>
            </Link>
          ) : null}
        </div>
      </div>

      <Card>
        <div className="inventory__toolbar">
          <SearchInput
            value={term}
            onChange={setTerm}
            placeholder="Search name, part no or QR ID"
            label="Search spare parts"
          />

          <SegmentedControl
            options={statusTabs}
            value={params.status || 'All'}
            onChange={(value) => setParams({ status: value })}
            label="Stock status"
          />

          <div className="inventory__filter">
            <Select
              size="sm"
              value={params.category || ''}
              onChange={(event) => setParams({ category: event.target.value })}
              options={toSelectOptions(categories?.rows ?? [])}
              placeholder="All categories"
              aria-label="Category"
            />
          </div>

          {hasFilters ? (
            <Button
              variant="secondary"
              size="sm"
              icon={X}
              onClick={() => {
                setTerm('');
                clear();
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>

        {isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <>
            <TableWrap minWidth={960}>
              <thead>
                <tr>
                  <Th width={52}>QR</Th>
                  <SortableTh column="name" sort={sort} direction={direction} onSort={toggleSort}>
                    Spare part
                  </SortableTh>
                  <Th>Category</Th>
                  <SortableTh column="selling_price" sort={sort} direction={direction} onSort={toggleSort} align="right">
                    Price
                  </SortableTh>
                  <SortableTh column="quantity" sort={sort} direction={direction} onSort={toggleSort} align="right">
                    Stock
                  </SortableTh>
                  <Th width={118}>Status</Th>
                  <SortableTh column="updated_at" sort={sort} direction={direction} onSort={toggleSort} width={96}>
                    Updated
                  </SortableTh>
                  <Th align="right" width={128}>
                    Actions
                  </Th>
                </tr>
              </thead>

              {isLoading ? (
                <SkeletonRows rows={8} columns={8} />
              ) : (
                <tbody className={isFetching ? 'is-refreshing' : ''}>
                  {rows.map((part) => (
                    <Tr key={part.id}>
                      <Td>
                        <QrImage code={part.qr_code} size={30} />
                      </Td>

                      <Td>
                        <button
                          type="button"
                          className="table__primary"
                          onClick={() => navigate(`/inventory/${part.id}`)}
                        >
                          <span className="table__primary-name">{part.name}</span>
                          <span className="table__primary-meta">
                            <span>{part.part_number}</span>
                            <span className="sep">|</span>
                            <span className="code">{part.qr_code || 'No QR'}</span>
                          </span>
                        </button>
                      </Td>

                      <Td nowrap className="inventory__category">
                        {part.category?.name || '—'}
                      </Td>

                      <Td align="right" nowrap className="num">
                        {money(part.selling_price)}
                      </Td>

                      <Td align="right" nowrap>
                        <span className="inventory__qty num" style={{ color: stockQuantityTone(part) }}>
                          {number(part.quantity)}
                        </span>
                        <span className="inventory__min"> / {part.min_stock}</span>
                      </Td>

                      <Td>
                        <Badge tone={stockStatusTone(part)} dot>
                          {stockStatusLabel(part)}
                        </Badge>
                      </Td>

                      <Td nowrap className="inventory__updated">
                        {relativeDays(part.updated_at)}
                      </Td>

                      <Td>
                        <div className="table__row-actions">
                          {can(PERMISSIONS.CREATE_STOCK_OUT) ? (
                            <IconButton
                              icon={Plus}
                              label="Add to current order"
                              variant="solid"
                              onClick={() => onAddToCart(part)}
                            />
                          ) : null}
                          {can(PERMISSIONS.UPDATE_INVENTORY) ? (
                            <IconButton
                              icon={SlidersHorizontal}
                              label="Adjust stock"
                              onClick={() => setAdjusting(part)}
                            />
                          ) : null}
                          <IconButton
                            icon={ChevronRight}
                            label="Open part"
                            onClick={() => navigate(`/inventory/${part.id}`)}
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
                icon={Package}
                title="No spare parts match this view"
                description="Nothing found for the current search, category and status combination. Clear the filters, or scan a QR label to jump straight to a part."
                actions={
                  <>
                    {hasFilters ? (
                      <Button
                        onClick={() => {
                          setTerm('');
                          clear();
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : null}
                    {can(PERMISSIONS.SCAN_QR) ? (
                      <Link to="/scan">
                        <Button variant="secondary" icon={ScanLine}>
                          Scan a QR label
                        </Button>
                      </Link>
                    ) : null}
                  </>
                }
              />
            ) : null}

            <Pagination meta={meta} onPage={setPage} unit="parts" />
          </>
        )}
      </Card>

      <AdjustStockModal open={!!adjusting} part={adjusting} onClose={() => setAdjusting(null)} />
    </div>
  );
}
