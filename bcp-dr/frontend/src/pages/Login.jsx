import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AlertMessage from '../components/AlertMessage';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../services/api';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await userApi.login(form);
      login(data);
      navigate(location.state?.from || '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-split">
      <section className="auth-hero" aria-hidden="true">
        <div className="auth-hero-copy">
          <span className="auth-hero-kicker">E-commerce Platform</span>
          <h2>Shop smarter.<br />Sign in to continue.</h2>
          <p>Browse products, place orders, and track everything in one place.</p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-form">
          <p className="auth-brand">E-commerce Platform</p>
          <h1>Welcome back</h1>
          <p className="auth-subtitle">Please enter your details to log in</p>
          <AlertMessage error={error} />
          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Email"
                required
                autoComplete="email"
              />
            </div>
            <div className="auth-field auth-field-password">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Password"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="auth-toggle"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? 'Logging in...' : 'Log in'}
            </button>
          </form>
          <p className="auth-switch">
            Don&apos;t have an account? <Link to="/register">Sign up</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
