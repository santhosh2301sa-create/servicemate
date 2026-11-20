import { useState, type FormEvent } from 'react';
import { apiRequest, setAuthToken } from '../lib/api';
import type { AuthUser, UserRole } from '../types';

interface AuthViewProps {
  onSuccess: (user: AuthUser) => void;
  defaultTab?: 'login' | 'register';
  defaultRole?: 'customer' | 'provider';
}

export function AuthView({
  onSuccess,
  defaultTab = 'login',
  defaultRole = 'customer',
}: AuthViewProps) {
  const [tab, setTab] = useState<'login' | 'register'>(defaultTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'customer' | 'provider'>(defaultRole);
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('Bengaluru, KA');
  const [serviceArea, setServiceArea] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (tab === 'login') {
        const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: email.trim(), password }),
        });
        setAuthToken(res.token);
        onSuccess(res.user);
      } else {
        const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            password,
            role,
            businessName: role === 'provider' ? businessName.trim() : undefined,
            city: role === 'provider' ? city.trim() : undefined,
            serviceArea: role === 'provider' ? serviceArea.trim() : undefined,
          }),
        });
        setAuthToken(res.token);
        onSuccess(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail: string, demoPass: string, _role: UserRole) => {
    setTab('login');
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {tab === 'login' ? 'Sign in to ServiceMate' : 'Create your ServiceMate account'}
          </h1>
          <p className="text-sm text-slate-600">
            Book local services, manage appointments, or run your provider schedule.
          </p>
        </div>

        {/* Segmented Auth Mode Tabs */}
        <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            className={`rounded-md py-2 text-sm font-medium transition-colors ${
              tab === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError(null);
            }}
            className={`rounded-md py-2 text-sm font-medium transition-colors ${
              tab === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'register' && (
            <>
              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-slate-700">Account Type</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['customer', 'provider'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                        role === r
                          ? 'border-teal-700 bg-teal-50 text-teal-900'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {r === 'customer' ? 'Customer' : 'Service Provider'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-700">Full Name</span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Rohan Deshmukh"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-700">Phone (optional)</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98450 12345"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </label>
              </div>

              {role === 'provider' && (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-700">Business Name</span>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Deshmukh Home Services"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-slate-700">City</span>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-slate-700">Neighborhoods Served</span>
                      <input
                        type="text"
                        value={serviceArea}
                        onChange={(e) => setServiceArea(e.target.value)}
                        placeholder="Indiranagar, Koramangala"
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                      />
                    </label>
                  </div>
                </div>
              )}
            </>
          )}

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700">Email Address</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-700">
              Password {tab === 'register' && '(minimum 8 characters)'}
            </span>
            <input
              type="password"
              required
              minLength={tab === 'register' ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </label>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Please wait...' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Demo Account Helper */}
        <div className="border-t border-slate-200 pt-5 space-y-3">
          <div className="text-xs font-semibold text-slate-700">
            Demo Sample Accounts (Quick Fill)
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => fillDemo('customer@servicemate.demo', 'CustomerDemo123!', 'customer')}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs hover:bg-slate-100 transition-colors"
            >
              <div className="font-semibold text-slate-900">Customer Demo (Aarav)</div>
              <div className="text-slate-500 truncate">customer@servicemate.demo</div>
            </button>
            <button
              type="button"
              onClick={() => fillDemo('rajesh@servicemate.demo', 'ProviderDemo123!', 'provider')}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs hover:bg-slate-100 transition-colors"
            >
              <div className="font-semibold text-slate-900">Provider Demo (Rajesh · Plumbing)</div>
              <div className="text-slate-500 truncate">rajesh@servicemate.demo</div>
            </button>
            <button
              type="button"
              onClick={() => fillDemo('kavitha@servicemate.demo', 'ProviderDemo123!', 'provider')}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs hover:bg-slate-100 transition-colors"
            >
              <div className="font-semibold text-slate-900">Provider Demo (Kavitha · Electrical)</div>
              <div className="text-slate-500 truncate">kavitha@servicemate.demo</div>
            </button>
            <button
              type="button"
              onClick={() => fillDemo('ananya@servicemate.demo', 'ProviderDemo123!', 'provider')}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs hover:bg-slate-100 transition-colors"
            >
              <div className="font-semibold text-slate-900">Provider Demo (Ananya · Tutoring)</div>
              <div className="text-slate-500 truncate">ananya@servicemate.demo</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
