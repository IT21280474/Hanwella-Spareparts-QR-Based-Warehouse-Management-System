import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ImagePlus, QrCode, Save, X } from 'lucide-react';
import { useCreatePart, usePartQuery, useUpdatePart } from '@/hooks/queries/useParts';
import { useCategoriesQuery, useSuppliersQuery, toSelectOptions } from '@/hooks/queries/useReference';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { toast } from '@/store/toastStore';
import { PART_STATUS, PART_STATUS_LABEL, toOptions } from '@/constants/options';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Field,
  Input,
  QrImage,
  Select,
  SegmentedControl,
  Skeleton,
  Textarea,
} from '@/components/ui';
import { money, percent } from '@/utils/format';
import { toApiError } from '@/utils/errors';
import './PartFormPage.css';

/** Empty string is what an untouched number input yields; treat it as absent. */
const optionalNumber = (message) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => (value === '' || value === null ? null : Number(value)))
    .refine((value) => value === null || (Number.isFinite(value) && value >= 0), message);

const requiredNumber = (message) =>
  z
    .union([z.string(), z.number()])
    .refine((value) => value !== '' && value !== null, message)
    .transform(Number)
    .refine((value) => Number.isFinite(value) && value >= 0, message);

const schema = z.object({
  name: z.string().trim().min(2, 'Give the part a recognisable name').max(160),
  part_number: z.string().trim().min(1, 'Part number is required').max(60),
  sku: z.string().trim().max(60).optional().or(z.literal('')),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  category_id: z.string().optional().or(z.literal('')),
  supplier_id: z.string().optional().or(z.literal('')),
  vehicle_make: z.string().trim().max(60).optional().or(z.literal('')),
  vehicle_model: z.string().trim().max(60).optional().or(z.literal('')),
  unit: z.string().trim().max(20).optional().or(z.literal('')),
  bin: z.string().trim().max(30).optional().or(z.literal('')),
  selling_price: requiredNumber('Enter a selling price'),
  cost_price: optionalNumber('Cost price cannot be negative'),
  min_stock: optionalNumber('Minimum stock cannot be negative'),
  quantity: requiredNumber('Enter the opening stock'),
  status: z.enum([PART_STATUS.ACTIVE, PART_STATUS.DISCONTINUED]),
});

// Kept in lockstep with backend/app/Http/Requests/Catalog/PartRequest.php —
// this is a UX convenience only; the server validates authoritatively.
const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

const EMPTY = {
  name: '',
  part_number: '',
  sku: '',
  description: '',
  category_id: '',
  supplier_id: '',
  vehicle_make: '',
  vehicle_model: '',
  unit: 'pcs',
  bin: '',
  selling_price: '',
  cost_price: '',
  min_stock: '5',
  quantity: '0',
  status: PART_STATUS.ACTIVE,
};

/**
 * Add and edit a spare part.
 *
 * One component serves both modes: the fields are identical, and only the
 * opening-stock field and the QR panel differ. Editing never touches quantity —
 * stock moves through receipts, issues and adjustments so every change leaves a
 * movement record behind.
 */
export default function PartFormPage({ mode = 'create' }) {
  const isEdit = mode === 'edit';
  const { id } = useParams();
  const navigate = useNavigate();

  useDocumentTitle(isEdit ? 'Edit spare part' : 'Add spare part');

  const existing = usePartQuery(isEdit ? id : null);
  const categories = useCategoriesQuery();
  const suppliers = useSuppliersQuery();

  const createPart = useCreatePart();
  const updatePart = useUpdatePart(id);
  const mutation = isEdit ? updatePart : createPart;

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [imageError, setImageError] = useState('');

  // Create-only: a part's bin may already carry a pre-printed physical
  // label (the original SJL-00001..SJL-01000 sheet) predating its entry
  // here — 'manual' assigns that exact code instead of the next one.
  const [qrMode, setQrMode] = useState('auto');
  const [manualQrCode, setManualQrCode] = useState('');

  // The existing photo shows until a new file is picked or removal is
  // requested; a freshly picked file always wins over the saved one.
  useEffect(() => {
    if (imageFile) return;
    setImagePreview(imageRemoved ? null : (existing.data?.image_url ?? null));
  }, [imageFile, imageRemoved, existing.data?.image_url]);

  // Object URLs must be revoked or they leak for the life of the tab.
  useEffect(() => {
    if (!imageFile) return undefined;
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const onPickImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // lets picking the same file twice still fire onChange
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageError('Choose an image file (JPEG, PNG or WebP).');
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setImageError('Photos must be 4MB or smaller.');
      return;
    }

    setImageError('');
    setImageRemoved(false);
    setImageFile(file);
  };

  const onRemoveImage = () => {
    setImageFile(null);
    setImageError('');
    setImageRemoved(true);
  };

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    watch,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });

  // Populate once the record arrives. Selects are strings; the API sends ids.
  useEffect(() => {
    if (!isEdit || !existing.data) return;
    const part = existing.data;
    setImageFile(null);
    setImageRemoved(false);
    setImageError('');
    setQrMode('auto');
    setManualQrCode('');
    reset({
      ...EMPTY,
      name: part.name ?? '',
      part_number: part.part_number ?? '',
      sku: part.sku ?? '',
      description: part.description ?? '',
      category_id: part.category?.id ? String(part.category.id) : '',
      supplier_id: part.supplier?.id ? String(part.supplier.id) : '',
      vehicle_make: part.vehicle_make ?? '',
      vehicle_model: part.vehicle_model ?? '',
      unit: part.unit ?? 'pcs',
      bin: part.bin ?? '',
      selling_price: String(part.selling_price ?? ''),
      cost_price: String(part.cost_price ?? ''),
      min_stock: String(part.min_stock ?? ''),
      quantity: String(part.quantity ?? 0),
      status: part.status ?? PART_STATUS.ACTIVE,
    });
  }, [isEdit, existing.data, reset]);

  const sellingPrice = Number(watch('selling_price')) || 0;
  const costPrice = Number(watch('cost_price')) || 0;
  const margin = sellingPrice > 0 ? percent(sellingPrice - costPrice, sellingPrice) : 0;

  const onSubmit = async (values) => {
    const payload = {
      ...values,
      sku: values.sku || null,
      description: values.description || null,
      category_id: values.category_id ? Number(values.category_id) : null,
      supplier_id: values.supplier_id ? Number(values.supplier_id) : null,
      vehicle_make: values.vehicle_make || null,
      vehicle_model: values.vehicle_model || null,
      unit: values.unit || 'pcs',
      bin: values.bin || null,
      cost_price: values.cost_price ?? 0,
      min_stock: values.min_stock ?? 0,
    };

    // Quantity is opening stock, and only on creation. An edit that carried it
    // would move stock without writing a movement.
    if (isEdit) delete payload.quantity;

    if (imageFile) payload.image = imageFile;
    else if (isEdit && imageRemoved) payload.remove_image = true;

    if (!isEdit && qrMode === 'manual') {
      const code = manualQrCode.trim();
      if (!code) {
        setError('qr_code', { type: 'manual', message: 'Enter the code printed on the physical label.' });
        return;
      }
      payload.qr_code = code.toUpperCase();
    }

    try {
      const result = await mutation.mutateAsync(payload);
      const part = result.part;
      toast.success(
        isEdit ? 'Spare part updated' : 'Spare part added',
        part?.qr_code ? `${part.name} · ${part.qr_code}` : part?.name,
      );
      navigate(`/inventory/${part?.id ?? id}`, { replace: true });
    } catch (error) {
      const apiError = toApiError(error);

      if (apiError.isValidation) {
        Object.entries(apiError.errors).forEach(([field, messages]) => {
          setError(field, { type: 'server', message: Array.isArray(messages) ? messages[0] : messages });
        });
        toast.error('Check the highlighted fields', apiError.message);
        return;
      }

      toast.fromError(error, isEdit ? 'Could not save changes' : 'Could not add this part');
    }
  };

  if (isEdit && existing.isError) {
    return (
      <Card>
        <ErrorState error={existing.error} onRetry={existing.refetch} />
      </Card>
    );
  }

  const loading = isEdit && existing.isLoading;

  return (
    <div className="part-form">
      <div className="part-form__back">
        <Link to={isEdit ? `/inventory/${id}` : '/inventory'} className="part-form__back-link">
          <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" />
          {isEdit ? 'Back to part' : 'All spare parts'}
        </Link>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="part-form__layout">
        <div className="part-form__main">
          <Card>
            <CardHeader title="Identity" subtitle="How the part is recognised on the shelf and on a bill" />
            <CardBody className="part-form__fields">
              <Field label="Part name" required error={errors.name?.message} className="part-form__span">
                {(field) =>
                  loading ? (
                    <Skeleton height={42} />
                  ) : (
                    <Input {...field} {...register('name')} placeholder="Brake pad set — front axle" autoFocus />
                  )
                }
              </Field>

              <Field label="Part number" required error={errors.part_number?.message}>
                {(field) =>
                  loading ? <Skeleton height={42} /> : <Input {...field} {...register('part_number')} mono placeholder="04465-0K260" />
                }
              </Field>

              <Field label="SKU" hint="Optional internal code" error={errors.sku?.message}>
                {(field) => (loading ? <Skeleton height={42} /> : <Input {...field} {...register('sku')} mono />)}
              </Field>

              <Field label="Category" error={errors.category_id?.message}>
                {(field) =>
                  loading ? (
                    <Skeleton height={42} />
                  ) : (
                    <Select
                      {...field}
                      {...register('category_id')}
                      options={toSelectOptions(categories.data?.rows ?? [])}
                      placeholder="Uncategorised"
                    />
                  )
                }
              </Field>

              <Field label="Supplier" error={errors.supplier_id?.message}>
                {(field) =>
                  loading ? (
                    <Skeleton height={42} />
                  ) : (
                    <Select
                      {...field}
                      {...register('supplier_id')}
                      options={toSelectOptions(suppliers.data?.rows ?? [])}
                      placeholder="Not recorded"
                    />
                  )
                }
              </Field>

              <Field label="Description" error={errors.description?.message} className="part-form__span">
                {(field) =>
                  loading ? (
                    <Skeleton height={72} />
                  ) : (
                    <Textarea
                      {...field}
                      {...register('description')}
                      rows={3}
                      placeholder="Material, fitment notes, anything a counter assistant needs to confirm the right part."
                    />
                  )
                }
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Fitment & storage" subtitle="Vehicle compatibility and where it is kept" />
            <CardBody className="part-form__fields">
              <Field label="Vehicle make" error={errors.vehicle_make?.message}>
                {(field) => (loading ? <Skeleton height={42} /> : <Input {...field} {...register('vehicle_make')} placeholder="Toyota" />)}
              </Field>

              <Field label="Vehicle model" error={errors.vehicle_model?.message}>
                {(field) => (loading ? <Skeleton height={42} /> : <Input {...field} {...register('vehicle_model')} placeholder="Hiace KDH200" />)}
              </Field>

              <Field label="Bin" hint="Primary storage location" error={errors.bin?.message}>
                {(field) => (loading ? <Skeleton height={42} /> : <Input {...field} {...register('bin')} mono placeholder="A-04-2" />)}
              </Field>

              <Field label="Unit" error={errors.unit?.message}>
                {(field) => (loading ? <Skeleton height={42} /> : <Input {...field} {...register('unit')} placeholder="pcs" />)}
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Pricing & stock levels" subtitle="What it sells for, and when to reorder" />
            <CardBody className="part-form__fields">
              <Field label="Selling price" required error={errors.selling_price?.message}>
                {(field) =>
                  loading ? (
                    <Skeleton height={42} />
                  ) : (
                    <Input {...field} {...register('selling_price')} inputMode="decimal" prefix="Rs" />
                  )
                }
              </Field>

              <Field label="Cost price" error={errors.cost_price?.message}>
                {(field) =>
                  loading ? <Skeleton height={42} /> : <Input {...field} {...register('cost_price')} inputMode="decimal" prefix="Rs" />
                }
              </Field>

              <Field
                label="Minimum stock"
                hint="Below this the part is flagged for restocking"
                error={errors.min_stock?.message}
              >
                {(field) => (loading ? <Skeleton height={42} /> : <Input {...field} {...register('min_stock')} inputMode="numeric" />)}
              </Field>

              {isEdit ? (
                <Field label="On hand" hint="Changed through receipts, issues and adjustments — not here">
                  {(field) => (
                    <Input {...field} value={existing.data?.quantity ?? ''} readOnly disabled aria-readonly="true" />
                  )}
                </Field>
              ) : (
                <Field
                  label="Opening stock"
                  required
                  hint="Recorded as the first stock receipt for this part"
                  error={errors.quantity?.message}
                >
                  {(field) => <Input {...field} {...register('quantity')} inputMode="numeric" />}
                </Field>
              )}

              <Field label="Status" error={errors.status?.message}>
                {(field) =>
                  loading ? (
                    <Skeleton height={42} />
                  ) : (
                    <Select {...field} {...register('status')} options={toOptions(PART_STATUS_LABEL)} />
                  )
                }
              </Field>
            </CardBody>
          </Card>
        </div>

        <aside className="part-form__aside">
          <Card>
            <CardHeader title="Photo" subtitle="Optional — helps staff confirm the right part at a glance" />
            <CardBody>
              <div className="part-form__photo">
                {loading ? (
                  <Skeleton width={140} height={140} radius="var(--radius-md)" />
                ) : imagePreview ? (
                  <div className="part-form__photo-preview">
                    <img src={imagePreview} alt="" className="part-form__photo-img" />
                    <button
                      type="button"
                      className="part-form__photo-remove"
                      onClick={onRemoveImage}
                      aria-label="Remove photo"
                      title="Remove photo"
                    >
                      <X size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <span className="part-form__photo-placeholder" aria-hidden="true">
                    <ImagePlus size={28} strokeWidth={1.3} />
                  </span>
                )}

                <label className="part-form__photo-picker">
                  {imagePreview ? 'Change photo' : 'Choose photo'}
                  <input type="file" accept={IMAGE_ACCEPT} onChange={onPickImage} hidden />
                </label>
                {imageError ? <p className="part-form__photo-error">{imageError}</p> : null}
                <p className="part-form__qr-note">JPEG, PNG or WebP — 4MB max.</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="QR identity" subtitle="One identity per part type" />
            <CardBody>
              {isEdit && existing.data?.qr_code ? (
                <div className="part-form__qr">
                  <QrImage code={existing.data.qr_code} size={104} />
                  <p className="part-form__qr-code mono">{existing.data.qr_code}</p>
                  <p className="part-form__qr-note">
                    Fixed for the life of the part. Editing details never reissues it, so labels already on the bins
                    stay valid.
                  </p>
                </div>
              ) : (
                <>
                  <SegmentedControl
                    className="part-form__qr-toggle"
                    label="How to assign the QR identity"
                    size="sm"
                    value={qrMode}
                    onChange={(mode) => {
                      setQrMode(mode);
                      clearErrors('qr_code');
                    }}
                    options={[
                      { value: 'auto', label: 'Auto-assign' },
                      { value: 'manual', label: 'Use existing code' },
                    ]}
                  />

                  {qrMode === 'auto' ? (
                    <div className="part-form__qr">
                      <span className="part-form__qr-placeholder" aria-hidden="true">
                        <QrCode size={40} strokeWidth={1.3} />
                      </span>
                      <p className="part-form__qr-note">
                        The next identity in the <span className="mono">SJL-</span> sequence is assigned by the
                        server when you save, so two people adding parts at once can never be issued the same code.
                      </p>
                    </div>
                  ) : (
                    <div className="part-form__qr-manual">
                      <Field
                        label="Existing QR code"
                        hint="From the physical label already on this part's bin"
                        error={errors.qr_code?.message}
                      >
                        {(field) => (
                          <Input
                            {...field}
                            mono
                            placeholder="SJL-00042"
                            value={manualQrCode}
                            onChange={(event) => setManualQrCode(event.target.value)}
                          />
                        )}
                      </Field>
                      <p className="part-form__qr-note">
                        The server still rejects it if that code is already assigned to another part, or does not
                        match the printed format.
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Margin" subtitle="From the prices entered" />
            <CardBody>
              <div className="part-form__margin">
                <p className="part-form__margin-value">{margin}%</p>
                <p className="part-form__margin-sub">
                  {money(Math.max(0, sellingPrice - costPrice))} per {watch('unit') || 'unit'}
                </p>
              </div>
            </CardBody>
          </Card>

          <div className="part-form__submit">
            <Button type="submit" size="lg" fullWidth icon={Save} loading={mutation.isPending} disabled={loading}>
              {isEdit ? 'Save changes' : 'Add spare part'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => navigate(isEdit ? `/inventory/${id}` : '/inventory')}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            {isDirty ? <p className="part-form__dirty">Unsaved changes</p> : null}
          </div>
        </aside>
      </form>
    </div>
  );
}
