import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldCheck } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { toApiError } from '@/utils/errors';
import '@/pages/auth/Auth.css';
import './SecurityLoginPage.css';

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Sign-in for the yard gate.
 *
 * The same session system as the main sign-in — one cookie, one login
 * endpoint — sent with `portal: 'security'`, which makes the server turn away
 * any account that cannot work the gate. There is deliberately no "keep me
 * signed in": a gate terminal is shared between shifts.
 */
export default function SecurityLoginPage() {
  useDocumentTitle('Security sign-in');
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
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values) => {
    setFormError('');
    try {
      await login({ ...values, portal: 'security' });

      const wanted = location.state?.from?.pathname;
      navigate(wanted?.startsWith('/security') ? wanted : '/security/dashboard', { replace: true });
    } catch (error) {
      const apiError = toApiError(error);

      if (apiError.isValidation) {
        Object.entries(apiError.errors).forEach(([field, messages]) => {
          setError(field === 'portal' ? 'email' : field, {
            type: 'server',
            message: Array.isArray(messages) ? messages[0] : messages,
          });
        });
        return;
      }

      setFormError(apiError.message);
    }
  };

  return (
    <div>
      <span className="security-login__mark" aria-hidden="true">
        <ShieldCheck size={22} strokeWidth={1.8} />
      </span>
      <h1 className="auth-form__title">Security sign-in</h1>
      <p className="auth-form__subtitle">Yard gate staff only. Sign in with your Security account.</p>

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
              placeholder="security@hanwellaspares.lk"
            />
          )}
        </Field>

        <Field label="Password" required error={errors.password?.message} className="auth-form__field">
          {(field) => (
            <Input {...field} {...register('password')} type="password" size="lg" autoComplete="current-password" />
          )}
        </Field>

        <div className="auth-form__row">
          <span />
          <Link to="/forgot-password" className="auth-form__link">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={isSubmitting} icon={ShieldCheck}>
          {isSubmitting ? 'Signing in…' : 'Sign in to the gate'}
        </Button>
      </form>

      <p className="auth-form__note">
        Warehouse or sales staff? <Link to="/login">Use the main sign-in</Link>. Repeated failed attempts are
        rate-limited.
      </p>
    </div>
  );
}
