import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui';
import { authApi } from '@/services/api';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { toApiError } from '@/utils/errors';
import './Auth.css';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
});

/**
 * Password reset request.
 *
 * The confirmation is deliberately identical whether or not the address exists
 * — the screen must not become a way to test which emails hold accounts.
 */
export default function ForgotPasswordPage() {
  useDocumentTitle('Reset password');
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const onSubmit = async (values) => {
    setFormError('');
    try {
      await authApi.forgotPassword(values.email);
      setSent(true);
    } catch (error) {
      const apiError = toApiError(error);
      // A throttled request is the one case worth reporting: the user needs to
      // know to wait rather than to keep pressing.
      setFormError(apiError.isThrottled ? apiError.message : '');
      if (!apiError.isThrottled) setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="auth-form__success">
        <span className="auth-form__success-mark" aria-hidden="true">
          <Check size={24} strokeWidth={2} />
        </span>
        <h1 className="auth-form__success-title">Check your email</h1>
        <p className="auth-form__success-text">
          If that address has an account, a reset link is on its way. The link expires in 30 minutes.
        </p>
        <Link to="/login">
          <Button variant="secondary">Back to sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="auth-form__title">Reset password</h1>
      <p className="auth-form__subtitle">
        Enter the email on your account and we will send a link to set a new password.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {formError ? (
          <p className="auth-form__alert" role="alert">
            {formError}
          </p>
        ) : null}

        <Field label="Email" required error={errors.email?.message}>
          {(field) => (
            <Input
              {...field}
              {...register('email')}
              type="email"
              size="lg"
              autoComplete="username"
              autoFocus
              placeholder="you@hanwellaspares.lk"
            />
          )}
        </Field>

        <div style={{ marginTop: 20 }}>
          <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
            Send reset link
          </Button>
        </div>
      </form>

      <Link to="/login">
        <button type="button" className="auth-form__back">
          Back to sign in
        </button>
      </Link>
    </div>
  );
}
