import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest, formatDateReadable, formatPrice, formatTime24to12, setAuthToken } from '../lib/api';
import type { AuthUser, BookingItem, Category } from '../types';

interface AdminPortalViewProps {
  user: AuthUser | null;
  onAuthSuccess: (user: AuthUser) => void;
  onSignOut: () => void;
}

interface AdminStatus {
  envPasscodeActive: boolean;
  adminClaimed: boolean;
}

interface AdminOverview {
  stats: {
    totalUsers: number;
    totalProviders: number;
    activeCategories: number;
    totalBookings: number;
    activeBookings: number;
  };
  users: Array<{
    id: number;
    name: string;
    email: string;
    phone: string;
    role: string;
    is_active: number;
    created_at: string;
  }>;
  providers: Array<{
    id: number;
    display_name: string;
    business_name: string;
    city: string;
    user_email: string;
    service_count: number;
    booking_count: number;
    is_active: number;
  }>;
  categories: Category[];
  bookings: BookingItem[];
}

export function AdminPortalView({ user, onAuthSuccess, onSignOut }: AdminPortalViewProps) {
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [tab, setTab] = useState<'bookings' | 'providers' | 'categories' | 'users'>('bookings');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Admin auth forms
  const [claimName, setClaimName] = useState('Platform Admin');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // New Category form
  const [catName, setCatName] = useState('');
  const [catDescription, setCatDescription] = useState('');

  const loadStatus = async () => {
    try {
      const res = await apiRequest<AdminStatus>('/api/auth/admin/status');
      setAdminStatus(res);
    } catch {
      // Ignore
    }
  };

  const loadOverview = async () => {
    if (user?.role !== 'admin') return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<AdminOverview>('/api/admin/overview');
      setOverview(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load admin overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      void loadOverview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  const handleAdminClaim = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/admin/claim', {
        method: 'POST',
        body: JSON.stringify({
          name: claimName.trim(),
          email: adminEmail.trim(),
          password: adminPassword,
        }),
      });
      setAuthToken(res.token);
      onAuthSuccess(res.user);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to claim admin account.');
    }
  };

  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({
          email: adminStatus?.envPasscodeActive ? undefined : adminEmail.trim(),
          password: adminPassword,
        }),
      });
      setAuthToken(res.token);
      onAuthSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin authentication failed.');
    }
  };

  const toggleUserActive = async (userId: number, currentActive: number) => {
    setError(null);
    try {
      await apiRequest(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: currentActive !== 1 }),
      });
      setNotice('User account status updated.');
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update user.');
    }
  };

  const toggleProviderActive = async (providerId: number, currentActive: number) => {
    setError(null);
    try {
      await apiRequest(`/api/admin/providers/${providerId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: currentActive !== 1 }),
      });
      setNotice('Provider listing visibility updated.');
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update provider listing.');
    }
  };

  const handleCreateCategory = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: catName.trim(),
          description: catDescription.trim(),
        }),
      });
      setCatName('');
      setCatDescription('');
      setNotice('Category created.');
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create category.');
    }
  };

  const toggleCategoryActive = async (cat: Category) => {
    setError(null);
    try {
      await apiRequest(`/api/admin/categories/${cat.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: cat.name,
          description: cat.description,
          sortOrder: cat.sort_order,
          isActive: cat.is_active !== 1,
        }),
      });
      setNotice(`Category "${cat.name}" updated.`);
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update category.');
    }
  };

  const adminCancelBooking = async (bookingId: number) => {
    setError(null);
    try {
      await apiRequest(`/api/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: 'Cancelled by platform admin' }),
      });
      setNotice('Booking cancelled.');
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel booking.');
    }
  };

  // Ordinary customer or provider is blocked from Admin area
  if (user && user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-xl border border-red-200 bg-white p-8 text-center space-y-4">
          <ShieldAlert className="mx-auto h-10 w-10 text-red-700" aria-hidden="true" />
          <h1 className="font-display text-xl font-bold text-slate-900">
            Admin Access Restricted
          </h1>
          <p className="text-sm text-slate-600">
            Your account ({user.email}) has the <span className="font-semibold">{user.role}</span> role. Admin routes are protected and cannot be accessed by ordinary customer or provider accounts.
          </p>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Sign Out to Switch Account
          </button>
        </div>
      </div>
    );
  }

  // Unauthenticated Admin Setup or Sign In
  if (!user) {
    const showFirstRunClaim = adminStatus && !adminStatus.envPasscodeActive && !adminStatus.adminClaimed;

    return (
      <div className="mx-auto max-w-md px-4 py-14">
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-6 w-6 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900">
                {showFirstRunClaim ? 'First-Run Admin Setup' : 'Admin Portal Sign In'}
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                {showFirstRunClaim
                  ? 'No admin account has been configured yet. Claim the initial administrator credentials below to lock setup.'
                  : adminStatus?.envPasscodeActive
                    ? 'Enter the server ADMIN_PASSCODE configured in your environment.'
                    : 'Sign in with your claimed administrator email and password.'}
              </p>
            </div>
          </div>

          {showFirstRunClaim ? (
            <form onSubmit={handleAdminClaim} className="space-y-4">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700">Admin Name</span>
                <input
                  type="text"
                  required
                  value={claimName}
                  onChange={(e) => setClaimName(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700">Admin Email</span>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@servicemate.local"
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700">Admin Password (min 8 chars)</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </label>
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
              >
                Claim Admin Account
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              {!adminStatus?.envPasscodeActive && (
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-700">Admin Email</span>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@servicemate.local"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </label>
              )}
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700">
                  {adminStatus?.envPasscodeActive ? 'Admin Passcode' : 'Password'}
                </span>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </label>
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
              >
                Sign In to Admin Area
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-6 pb-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            Platform Administration
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage users, provider visibility, service categories, and bookings.
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              ['bookings', 'Bookings'],
              ['providers', 'Providers'],
              ['categories', 'Categories'],
              ['users', 'Users'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setNotice(null);
              }}
              className={`rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                tab === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-900">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
          {error}
        </div>
      )}

      {loading && !overview ? (
        <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
      ) : (
        overview && (
          <>
            {/* Summary Metrics Strip */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              {[
                ['Users', overview.stats.totalUsers],
                ['Providers', overview.stats.totalProviders],
                ['Active Categories', overview.stats.activeCategories],
                ['Total Bookings', overview.stats.totalBookings],
                ['Active Bookings', overview.stats.activeBookings],
              ].map(([label, val]) => (
                <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {val}
                  </div>
                </div>
              ))}
            </div>

            {tab === 'bookings' && (
              <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Ref</th>
                      <th className="px-4 py-3">Service</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">Date &amp; Time</th>
                      <th className="px-4 py-3 text-right">Price</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overview.bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 tabular-nums">
                          {b.reference_code}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{b.service_title}</td>
                        <td className="px-4 py-3 text-slate-600">{b.customer_name}</td>
                        <td className="px-4 py-3 text-slate-600">{b.provider_name}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 tabular-nums">
                          {formatDateReadable(b.booking_date)} · {formatTime24to12(b.start_time)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-900 tabular-nums">
                          {formatPrice(b.total_price_cents)}
                        </td>
                        <td className="px-4 py-3 capitalize text-xs font-medium text-slate-800">
                          {b.status}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {(b.status === 'pending' || b.status === 'confirmed') && (
                            <button
                              type="button"
                              onClick={() => void adminCancelBooking(b.id)}
                              className="rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'providers' && (
              <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">Business</th>
                      <th className="px-4 py-3">City</th>
                      <th className="px-4 py-3 text-right">Services</th>
                      <th className="px-4 py-3 text-right">Bookings</th>
                      <th className="px-4 py-3">Listing State</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overview.providers.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{p.display_name}</td>
                        <td className="px-4 py-3 text-slate-600">{p.business_name}</td>
                        <td className="px-4 py-3 text-slate-600">{p.city}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{p.service_count}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{p.booking_count}</td>
                        <td className="px-4 py-3 text-xs font-medium">
                          {p.is_active === 1 ? 'Active' : 'Hidden'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => void toggleProviderActive(p.id, p.is_active)}
                            className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            {p.is_active === 1 ? 'Hide Listing' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'categories' && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
                <form
                  onSubmit={handleCreateCategory}
                  className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5 space-y-4"
                >
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    Add Category
                  </h2>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-700">Name</span>
                    <input
                      type="text"
                      required
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      placeholder="e.g. Carpentry"
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-teal-600 focus:outline-none"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-700">Description</span>
                    <textarea
                      rows={2}
                      value={catDescription}
                      onChange={(e) => setCatDescription(e.target.value)}
                      placeholder="Short summary of services in this category"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                    />
                  </label>
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                  >
                    Create Category
                  </button>
                </form>

                <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                  {overview.categories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between gap-4 p-4">
                      <div>
                        <div className="font-medium text-slate-900">
                          {cat.name}{' '}
                          <span className="text-xs font-normal text-slate-500">
                            · {cat.is_active === 1 ? 'Active' : 'Inactive'} · {cat.service_count ?? 0} services
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">{cat.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void toggleCategoryActive(cat)}
                        className="rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shrink-0"
                      >
                        {cat.is_active === 1 ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'users' && (
              <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overview.users.map((u) => (
                      <tr key={u.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                        <td className="px-4 py-3 text-slate-600">{u.email}</td>
                        <td className="px-4 py-3 capitalize text-slate-700">{u.role}</td>
                        <td className="px-4 py-3 text-xs font-medium">
                          {u.is_active === 1 ? 'Active' : 'Deactivated'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {u.id !== user.id && (
                            <button
                              type="button"
                              onClick={() => void toggleUserActive(u.id, u.is_active)}
                              className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              {u.is_active === 1 ? 'Deactivate' : 'Reactivate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs text-slate-500">
              Scope note: Implemented admin capabilities cover user activation, provider listing visibility, category creation/toggling, and booking cancellation. Financial payouts, refunds, and identity verification workflows are out of scope in this demo build.
            </p>
          </>
        )
      )}
    </div>
  );
}
