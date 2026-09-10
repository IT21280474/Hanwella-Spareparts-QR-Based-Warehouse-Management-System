import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Save, Users } from 'lucide-react';
import { settingsApi } from '@/services/api';
import { queryKeys } from '@/services/queryKeys';
import { useRolesQuery } from '@/hooks/queries/useUsers';
import { useWarehousesQuery, toSelectOptions } from '@/hooks/queries/useReference';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { toast } from '@/store/toastStore';
import { QR_LAYOUTS } from '@/constants/options';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Skeleton,
  Select,
  Tabs,
  Textarea,
} from '@/components/ui';
import { toApiError } from '@/utils/errors';
import './SettingsPage.css';

const TABS = [
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'qr', label: 'QR & numbering' },
  { value: 'roles', label: 'Roles' },
  { value: 'notifications', label: 'Notifications' },
];

/** Flatten the API's grouped settings into the flat shape the form binds to. */
const toForm = (settings) => ({
  company_name: settings?.company?.name ?? '',
  company_address: settings?.company?.address ?? '',
  company_contact: settings?.company?.contact ?? '',
  company_registration_no: settings?.company?.registration_no ?? '',

  default_warehouse_id: settings?.inventory?.default_warehouse_id
    ? String(settings.inventory.default_warehouse_id)
    : '',
  default_min_stock: String(settings?.inventory?.default_min_stock ?? 5),
  currency: settings?.inventory?.currency ?? 'Rs',

  qr_prefix: settings?.qr?.prefix ?? 'SJL',
  qr_padding: String(settings?.qr?.padding ?? 5),
  qr_default_layout: settings?.qr?.default_layout ?? QR_LAYOUTS[0].value,

  notify_low_stock: !!settings?.notifications?.low_stock,
  notify_out_of_stock: !!settings?.notifications?.out_of_stock,
  notify_daily_summary: !!settings?.notifications?.daily_summary,
  notify_email: settings?.notifications?.email ?? '',
});

/** Rebuild the grouped payload the API expects. */
const toPayload = (values) => ({
  company: {
    name: values.company_name,
    address: values.company_address || null,
    contact: values.company_contact || null,
    registration_no: values.company_registration_no || null,
  },
  inventory: {
    default_warehouse_id: values.default_warehouse_id ? Number(values.default_warehouse_id) : null,
    default_min_stock: Number(values.default_min_stock) || 0,
    currency: values.currency || 'Rs',
  },
  qr: {
    prefix: values.qr_prefix,
    padding: Number(values.qr_padding) || 5,
    default_layout: values.qr_default_layout,
  },
  notifications: {
    low_stock: values.notify_low_stock,
    out_of_stock: values.notify_out_of_stock,
    daily_summary: values.notify_daily_summary,
    email: values.notify_email || null,
  },
});

/**
 * System settings.
 *
 * One form behind four tabs: switching tabs never discards what was typed on
 * another, and saving submits the whole document. The QR prefix and padding
 * govern identities not yet issued — codes already printed keep the shape they
 * were created with.
 */
export default function SettingsPage() {
  useDocumentTitle('Settings');
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('warehouse');

  const warehouses = useWarehousesQuery();
  const roles = useRolesQuery();

  const { data: settings, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.settings(),
    queryFn: () => settingsApi.get(),
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isDirty },
  } = useForm({ defaultValues: toForm(null) });

  useEffect(() => {
    if (settings) reset(toForm(settings));
  }, [settings, reset]);

  const save = useMutation({
    mutationFn: (payload) => settingsApi.update(payload),
    onSuccess: ({ settings: saved, message }) => {
      queryClient.setQueryData(queryKeys.settings(), saved);
      reset(toForm(saved));
      toast.success('Settings saved', message || 'The changes are live.');
    },
    onError: (saveError) => {
      const apiError = toApiError(saveError);

      if (apiError.isValidation) {
        Object.entries(apiError.errors).forEach(([field, messages]) => {
          // Laravel reports `company.name`; the form field is `company_name`.
          setError(field.replace(/\./g, '_'), {
            type: 'server',
            message: Array.isArray(messages) ? messages[0] : messages,
          });
        });
        return;
      }

      toast.fromError(saveError, 'Could not save the settings');
    },
  });

  if (isError) {
    return (
      <Card>
        <ErrorState error={error} onRetry={refetch} />
      </Card>
    );
  }

  const nextCode = `${watch('qr_prefix') || 'SJL'}-${'1'.padStart(Number(watch('qr_padding')) || 5, '0')}`;

  return (
    <div className="settings">
      <PageHeader
        title="System settings"
        description="Company details on printed documents, stock defaults, QR numbering and alerts."
        actions={
          <Button
            icon={Save}
            loading={save.isPending}
            disabled={isLoading || !isDirty}
            onClick={handleSubmit((values) => save.mutate(toPayload(values)))}
          >
            Save changes
          </Button>
        }
      />

      <Card>
        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Settings section" className="settings__tabs" />
      </Card>

      <form onSubmit={handleSubmit((values) => save.mutate(toPayload(values)))} noValidate>
        {tab === 'warehouse' ? (
          <div className="settings__stack">
            <Card>
              <CardHeader title="Company" subtitle="Printed on every bill and label sheet" />
              <CardBody className="settings__fields">
                <Field label="Company name" required error={errors.company_name?.message} className="settings__span">
                  {(field) => (isLoading ? <Skeleton height={42} /> : <Input {...field} {...register('company_name')} />)}
                </Field>

                <Field label="Address" error={errors.company_address?.message} className="settings__span">
                  {(field) =>
                    isLoading ? <Skeleton height={72} /> : <Textarea {...field} {...register('company_address')} rows={2} />
                  }
                </Field>

                <Field label="Contact" hint="Phone or email shown on bills" error={errors.company_contact?.message}>
                  {(field) => (isLoading ? <Skeleton height={42} /> : <Input {...field} {...register('company_contact')} />)}
                </Field>

                <Field label="Registration number" error={errors.company_registration_no?.message}>
                  {(field) =>
                    isLoading ? <Skeleton height={42} /> : <Input {...field} {...register('company_registration_no')} mono />
                  }
                </Field>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Stock defaults" subtitle="Applied to newly created parts" />
              <CardBody className="settings__fields">
                <Field label="Default warehouse">
                  {(field) =>
                    isLoading ? (
                      <Skeleton height={42} />
                    ) : (
                      <Select
                        {...field}
                        {...register('default_warehouse_id')}
                        options={toSelectOptions(warehouses.data?.rows ?? [])}
                        placeholder="None"
                      />
                    )
                  }
                </Field>

                <Field label="Default minimum stock" hint="The level a new part is flagged below">
                  {(field) =>
                    isLoading ? <Skeleton height={42} /> : <Input {...field} {...register('default_min_stock')} inputMode="numeric" />
                  }
                </Field>

                <Field label="Currency symbol" hint="Shown beside every amount">
                  {(field) => (isLoading ? <Skeleton height={42} /> : <Input {...field} {...register('currency')} maxLength={5} />)}
                </Field>
              </CardBody>
            </Card>
          </div>
        ) : null}

        {tab === 'qr' ? (
          <Card>
            <CardHeader title="QR identities" subtitle="How new codes are formed" />
            <CardBody className="settings__fields">
              <Field label="Prefix" hint="Letters only, 2–6 characters">
                {(field) => (isLoading ? <Skeleton height={42} /> : <Input {...field} {...register('qr_prefix')} mono maxLength={6} />)}
              </Field>

              <Field label="Digits" hint="Zero-padded sequence length">
                {(field) => (isLoading ? <Skeleton height={42} /> : <Input {...field} {...register('qr_padding')} inputMode="numeric" />)}
              </Field>

              <Field label="Default sheet layout">
                {(field) =>
                  isLoading ? <Skeleton height={42} /> : <Select {...field} {...register('qr_default_layout')} options={QR_LAYOUTS} />
                }
              </Field>

              <div className="settings__preview settings__span">
                <div>
                  <p className="settings__preview-label">Next identity will look like</p>
                  <p className="settings__preview-value mono">{nextCode}</p>
                </div>
                <p className="settings__preview-note">
                  Changing this affects identities not yet issued. Codes already printed keep the shape they were
                  created with, so labels on the bins stay valid.
                </p>
              </div>
            </CardBody>
          </Card>
        ) : null}

        {tab === 'roles' ? (
          <Card>
            <CardHeader
              title="Roles"
              subtitle="What each role may do. Accounts are managed on their own screen."
              actions={
                <Link to="/users">
                  <Button variant="secondary" size="sm" icon={Users}>
                    Manage accounts
                  </Button>
                </Link>
              }
            />
            <CardBody>
              {roles.isLoading ? (
                <Skeleton height={140} />
              ) : (
                <ul className="settings__roles">
                  {(roles.data ?? []).map((role) => (
                    <li key={role.slug} className="settings__role">
                      <div className="settings__role-head">
                        <span className="settings__role-name">{role.name}</span>
                        <Badge tone="neutral" size="sm">
                          {(role.permissions ?? []).length} permissions
                        </Badge>
                      </div>
                      {role.description ? <p className="settings__role-desc">{role.description}</p> : null}
                      <div className="settings__role-perms">
                        {(role.permissions ?? []).map((permission) => (
                          <span key={permission} className="settings__perm mono">
                            {permission}
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <p className="settings__note">
                Permissions are enforced by the API on every request. Hiding a control in this interface is a
                convenience, never the security boundary.
              </p>
            </CardBody>
          </Card>
        ) : null}

        {tab === 'notifications' ? (
          <Card>
            <CardHeader title="Alerts" subtitle="What the warehouse is told about, and where" />
            <CardBody>
              <div className="settings__switches">
                <label className="settings__switch">
                  <input type="checkbox" {...register('notify_low_stock')} />
                  <span>
                    <span className="settings__switch-title">Low stock</span>
                    <span className="settings__switch-sub">When a part reaches its minimum level</span>
                  </span>
                </label>

                <label className="settings__switch">
                  <input type="checkbox" {...register('notify_out_of_stock')} />
                  <span>
                    <span className="settings__switch-title">Out of stock</span>
                    <span className="settings__switch-sub">When a part can no longer be sold</span>
                  </span>
                </label>

                <label className="settings__switch">
                  <input type="checkbox" {...register('notify_daily_summary')} />
                  <span>
                    <span className="settings__switch-title">Daily summary</span>
                    <span className="settings__switch-sub">Sales, receipts and outstanding balances, once a day</span>
                  </span>
                </label>
              </div>

              <Field
                label="Send alerts to"
                hint="Leave blank to show alerts only inside the application"
                error={errors.notify_email?.message}
                className="settings__email"
              >
                {(field) => <Input {...field} {...register('notify_email')} type="email" placeholder="stores@hanwellaspares.lk" />}
              </Field>
            </CardBody>
          </Card>
        ) : null}
      </form>

      {isDirty ? (
        <p className="settings__dirty" role="status">
          You have unsaved changes.
        </p>
      ) : null}
    </div>
  );
}
