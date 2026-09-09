import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AlertMessage from '../components/AlertMessage';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../services/api';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
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
      const data = await userApi.register(form);
      login(data);
      navigate('/');
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
          <h2>Create your account<br />and start shopping.</h2>
          <p>Join as a customer to browse products and place orders.</p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-form">
          <p className="auth-brand">E-commerce Platform</p>
          <h1>Create an account</h1>
          <p className="auth-subtitle">Enter your details below</p>
          <AlertMessage error={error} />
          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Name"
                required
                autoComplete="name"
              />
            </div>
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
                minLength={8}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="auth-toggle"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="auth-hint">Password must be at least 8 characters.</p>
            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>
          <p className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
