import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Field, Input } from '@/components/ui';
import { authApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { toApiError } from '@/utils/errors';
import { toast } from '@/store/toastStore';
import './Auth.css';

const schema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters'),
    password_confirmation: z.string().min(1, 'Confirm the new password'),
  })
  .refine((values) => values.password === values.password_confirmation, {
    path: ['password_confirmation'],
    message: 'The two passwords do not match',
  });

/**
 * Set a new password from an emailed link.
 *
 * The token and email arrive as query parameters and are passed straight
 * through; the server validates both before accepting the change.
 */
export default function ResetPasswordPage() {
  useDocumentTitle('Set a new password');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [formError, setFormError] = useState('');

  const token = params.get('token') || '';
  const email = params.get('email') || '';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { password: '', password_confirmation: '' },
  });

  const onSubmit = async (values) => {
    setFormError('');
    try {
      await authApi.resetPassword({ ...values, token, email });
      toast.success('Password updated', 'Sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  };

  if (!token || !email) {
    return (
      <div>
        <h1 className="auth-form__title">Link not valid</h1>
        <p className="auth-form__subtitle">
          This reset link is incomplete or has expired. Request a new one and use the most recent email.
        </p>
        <Link to="/forgot-password">
          <Button size="lg" fullWidth>
            Request a new link
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="auth-form__title">Set a new password</h1>
      <p className="auth-form__subtitle">Choose a password for {email}.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {formError ? (
          <p className="auth-form__alert" role="alert">
            {formError}
          </p>
        ) : null}

        <Field label="New password" required error={errors.password?.message}>
          {(field) => (
            <Input {...field} {...register('password')} type="password" size="lg" autoComplete="new-password" autoFocus />
          )}
        </Field>

        <Field
          label="Confirm new password"
          required
          error={errors.password_confirmation?.message}
          className="auth-form__field"
        >
          {(field) => (
            <Input
              {...field}
              {...register('password_confirmation')}
              type="password"
              size="lg"
              autoComplete="new-password"
            />
          )}
        </Field>

        <div style={{ marginTop: 20 }}>
          <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
            Update password
          </Button>
        </div>
      </form>
    </div>
  );
}
