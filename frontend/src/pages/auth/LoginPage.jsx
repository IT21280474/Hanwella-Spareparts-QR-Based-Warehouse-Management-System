import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Field, Input } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { toApiError } from '@/utils/errors';
import { homePathFor } from '@/constants/navigation';
import './Auth.css';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
});

/**
 * Sign-in.
 *
 * The password only ever travels in the request body — nothing is written to
 * storage, and the session comes back as an httpOnly cookie.
 */
export default function LoginPage() {
  useDocumentTitle('Sign in');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState('');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', remember: false },
  });

  const onSubmit = async (values) => {
    setFormError('');
    try {
      const user = await login(values);
      navigate(location.state?.from?.pathname || homePathFor(user), { replace: true });
    } catch (error) {
      const apiError = toApiError(error);

      if (apiError.isValidation) {
        // Field-level messages from Laravel, including the deliberately vague
        // "these credentials do not match our records".
        Object.entries(apiError.errors).forEach(([field, messages]) => {
          setError(field, { type: 'server', message: Array.isArray(messages) ? messages[0] : messages });
        });
        return;
      }

      setFormError(apiError.message);
    }
  };

  return (
    <div>
      <h1 className="auth-form__title">Sign in</h1>
      <p className="auth-form__subtitle">Use your warehouse account to continue.</p>

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

        <Field label="Password" required error={errors.password?.message} className="auth-form__field">
          {(field) => (
            <Input {...field} {...register('password')} type="password" size="lg" autoComplete="current-password" />
          )}
        </Field>

        <div className="auth-form__row">
          <label className="auth-form__remember">
            <input type="checkbox" {...register('remember')} />
            Keep me signed in
          </label>
          <Link to="/forgot-password" className="auth-form__link">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="auth-form__note">
        Accounts are issued by your warehouse administrator. Repeated failed attempts are rate-limited.
      </p>
    </div>
  );
}
