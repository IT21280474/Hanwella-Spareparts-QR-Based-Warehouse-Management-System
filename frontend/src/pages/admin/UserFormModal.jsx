import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateUser, useRolesQuery, useUpdateUser } from '@/hooks/queries/useUsers';
import { toast } from '@/store/toastStore';
import { Button, Field, Input, Modal, Select } from '@/components/ui';
import { toApiError } from '@/utils/errors';
import './UserFormModal.css';

const baseSchema = {
  name: z.string().trim().min(2, 'Enter the person’s name').max(120),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  role: z.string().min(1, 'Choose a role'),
};

/** A new account needs a password; an edit only sets one if it is filled in. */
const createSchema = z.object({
  ...baseSchema,
  password: z.string().min(8, 'Use at least 8 characters'),
});

const editSchema = z.object({
  ...baseSchema,
  password: z.string().max(72).optional().or(z.literal('')),
});

/**
 * Create or edit a warehouse account.
 *
 * The password only ever leaves this form inside the request body, and an
 * existing one is never read back — an empty field on an edit means "leave it
 * as it is", not "clear it".
 */
export function UserFormModal({ open, user, onClose }) {
  const isEdit = !!user;
  const roles = useRolesQuery();

  const createUser = useCreateUser();
  const updateUser = useUpdateUser(user?.id);
  const mutation = isEdit ? updateUser : createUser;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: { name: '', email: '', role: '', password: '' },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      name: user?.name ?? '',
      email: user?.email ?? '',
      role: user?.role?.slug ?? '',
      password: '',
    });
  }, [open, user, reset]);

  const onSubmit = async (values) => {
    const payload = { name: values.name, email: values.email, role: values.role };
    if (values.password) payload.password = values.password;

    try {
      const result = await mutation.mutateAsync(payload);
      toast.success(isEdit ? 'Account updated' : 'Account created', result.message || values.name);
      onClose();
    } catch (error) {
      const apiError = toApiError(error);

      if (apiError.isValidation) {
        Object.entries(apiError.errors).forEach(([field, messages]) => {
          setError(field, { type: 'server', message: Array.isArray(messages) ? messages[0] : messages });
        });
        return;
      }

      toast.fromError(error, isEdit ? 'Could not update the account' : 'Could not create the account');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit account' : 'New account'}
      description={isEdit ? user?.email : 'The person signs in with the email address below.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={mutation.isPending}>
            {isEdit ? 'Save changes' : 'Create account'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="user-form">
        <Field label="Name" required error={errors.name?.message}>
          {(field) => <Input {...field} {...register('name')} data-autofocus placeholder="Sadeeka Perera" />}
        </Field>

        <Field label="Email" required error={errors.email?.message}>
          {(field) => (
            <Input
              {...field}
              {...register('email')}
              type="email"
              autoComplete="off"
              placeholder="name@hanwellaspares.lk"
            />
          )}
        </Field>

        <Field label="Role" required error={errors.role?.message} hint="Decides what this account may do">
          {(field) => (
            <Select
              {...field}
              {...register('role')}
              options={(roles.data ?? []).map((role) => ({ value: role.slug, label: role.name }))}
              placeholder="Choose a role"
            />
          )}
        </Field>

        <Field
          label={isEdit ? 'New password' : 'Password'}
          required={!isEdit}
          error={errors.password?.message}
          hint={isEdit ? 'Leave blank to keep the current password' : 'At least 8 characters'}
        >
          {(field) => (
            <Input {...field} {...register('password')} type="password" autoComplete="new-password" />
          )}
        </Field>
      </form>
    </Modal>
  );
}
