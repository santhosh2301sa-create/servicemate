import { Calendar, CheckCircle2, Clock, Plus, Trash2, Lock, Unlock } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest, formatDateReadable, formatPrice, formatTime24to12 } from '../lib/api';
import type {
  AuthUser,
  AvailabilitySlot,
  BookingItem,
  Category,
  ProviderProfileRecord,
  ServiceItem,
  ServiceMode,
} from '../types';

interface ProviderPortalViewProps {
  user: AuthUser | null;
  onRequireProviderAuth: () => void;
}

interface DashboardResponse {
  profile: ProviderProfileRecord;
  services: ServiceItem[];
  slots: AvailabilitySlot[];
  bookings: BookingItem[];
}

function nextIsoDate(offsetDays = 1): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function ProviderPortalView({ user, onRequireProviderAuth }: ProviderPortalViewProps) {
  const [tab, setTab] = useState<'bookings' | 'availability' | 'services' | 'profile'>('bookings');
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Profile Form State
  const [displayName, setDisplayName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [city, setCity] = useState('');
  const [serviceMode, setServiceMode] = useState<ServiceMode>('in_person');
  const [yearsExperience, setYearsExperience] = useState(1);

  // Service Form State
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
  const [svcCategoryId, setSvcCategoryId] = useState<number>(1);
  const [svcTitle, setSvcTitle] = useState('');
  const [svcDescription, setSvcDescription] = useState('');
  const [svcPriceDollars, setSvcPriceDollars] = useState('799');
  const [svcDuration, setSvcDuration] = useState('60');
  const [svcMode, setSvcMode] = useState<ServiceMode>('in_person');

  // Availability Form State
  const [slotDate, setSlotDate] = useState(nextIsoDate(1));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:30');

  const isProviderOrAdmin = user?.role === 'provider' || user?.role === 'admin';

  const loadDashboard = async () => {
    if (!isProviderOrAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const [dashRes, catRes] = await Promise.all([
        apiRequest<DashboardResponse>('/api/provider/dashboard'),
        apiRequest<{ categories: Category[] }>('/api/categories'),
      ]);
      setDashboard(dashRes);
      setCategories(catRes.categories);
      if (catRes.categories.length > 0 && !editingServiceId) {
        setSvcCategoryId(catRes.categories[0].id);
      }
      const p = dashRes.profile;
      setDisplayName(p.display_name);
      setBusinessName(p.business_name);
      setHeadline(p.headline);
      setBio(p.bio);
      setServiceArea(p.service_area);
      setCity(p.city);
      setServiceMode(p.service_mode);
      setYearsExperience(p.years_experience);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load provider dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isProviderOrAdmin) {
      void loadDashboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  const showSuccess = (msg: string) => {
    setNotice(msg);
    setError(null);
  };

  const handleBookingStatus = async (bookingId: number, status: 'confirmed' | 'declined' | 'completed') => {
    setError(null);
    try {
      await apiRequest(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showSuccess(`Booking marked as ${status}.`);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update booking status.');
    }
  };

  const handleAddSingleSlot = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await apiRequest<{ addedCount: number }>('/api/provider/availability', {
        method: 'POST',
        body: JSON.stringify({
          slotDate,
          windows: [{ startTime, endTime }],
        }),
      });
      showSuccess(
        res.addedCount > 0 ? 'Time slot added to your schedule.' : 'That time slot already exists for this date.'
      );
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add slot.');
    }
  };

  const handleAddStandardDay = async () => {
    setError(null);
    try {
      const res = await apiRequest<{ addedCount: number }>('/api/provider/availability', {
        method: 'POST',
        body: JSON.stringify({
          slotDate,
          windows: [
            { startTime: '09:00', endTime: '10:30' },
            { startTime: '11:00', endTime: '12:30' },
            { startTime: '14:00', endTime: '15:30' },
            { startTime: '16:30', endTime: '18:00' },
          ],
        }),
      });
      showSuccess(`Added ${res.addedCount} standard time slots for ${formatDateReadable(slotDate)}.`);
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add standard slots.');
    }
  };

  const handleToggleBlockSlot = async (slot: AvailabilitySlot) => {
    setError(null);
    try {
      await apiRequest(`/api/provider/availability/${slot.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isBlocked: slot.is_blocked !== 1 }),
      });
      showSuccess(slot.is_blocked === 1 ? 'Time slot unblocked and open for bookings.' : 'Time slot marked unavailable.');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update slot.');
    }
  };

  const handleDeleteSlot = async (slotId: number) => {
    setError(null);
    try {
      await apiRequest(`/api/provider/availability/${slotId}`, { method: 'DELETE' });
      showSuccess('Unbooked time slot removed.');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove slot.');
    }
  };

  const handleSaveService = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload = {
      categoryId: Number(svcCategoryId),
      title: svcTitle.trim(),
      description: svcDescription.trim(),
      priceDollars: Number(svcPriceDollars),
      durationMinutes: Number(svcDuration),
      serviceMode: svcMode,
    };

    try {
      if (editingServiceId) {
        await apiRequest(`/api/provider/services/${editingServiceId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showSuccess('Service updated.');
      } else {
        await apiRequest('/api/provider/services', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showSuccess('New service added to your profile.');
      }
      setEditingServiceId(null);
      setSvcTitle('');
      setSvcDescription('');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save service.');
    }
  };

  const handleDeleteService = async (serviceId: number) => {
    setError(null);
    try {
      await apiRequest(`/api/provider/services/${serviceId}`, { method: 'DELETE' });
      showSuccess('Service removed from active listings.');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove service.');
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiRequest('/api/provider/profile', {
        method: 'PUT',
        body: JSON.stringify({
          displayName: displayName.trim(),
          businessName: businessName.trim(),
          headline: headline.trim(),
          bio: bio.trim(),
          serviceArea: serviceArea.trim(),
          city: city.trim(),
          serviceMode,
          yearsExperience: Number(yearsExperience),
        }),
      });
      showSuccess('Provider profile updated.');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    }
  };

  if (!user || !isProviderOrAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center space-y-5">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
          ServiceMate Provider Portal
        </h1>
        <p className="text-sm sm:text-base text-slate-600">
          {user
            ? `You are currently signed in as a ${user.role}. Sign in with a provider account or register as a service provider to manage services, availability slots, and booking requests.`
            : 'Sign in with a provider account—or create a new provider profile—to list services, set available hours, and manage customer bookings.'}
        </p>
        <button
          type="button"
          onClick={onRequireProviderAuth}
          className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors"
        >
          {user ? 'Switch to Provider Account' : 'Sign In or Register as Provider'}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-6 pb-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            Provider Workspace
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {dashboard?.profile.business_name || user.name} · Manage requests, open slots, and service catalog
          </p>
        </div>

        {/* Workspace Tab Controls */}
        <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              ['bookings', 'Booking Requests'],
              ['availability', 'Availability'],
              ['services', 'Services & Pricing'],
              ['profile', 'Profile'],
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

      {loading && !dashboard ? (
        <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
      ) : (
        dashboard && (
          <>
            {/* Tab 1: Bookings */}
            {tab === 'bookings' && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold text-slate-900">
                    Customer Booking Requests
                  </h2>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {dashboard.bookings.length} total bookings
                  </span>
                </div>

                {dashboard.bookings.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
                    No booking requests yet. Make sure you have active services and open time slots.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboard.bookings.map((b) => (
                      <div
                        key={b.id}
                        className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono font-semibold text-slate-900 tabular-nums">
                              {b.reference_code}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold capitalize text-slate-800">{b.status}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">
                              {formatDateReadable(b.booking_date)} · {formatTime24to12(b.start_time)} –{' '}
                              {formatTime24to12(b.end_time)}
                            </span>
                          </div>
                          <h3 className="font-display text-base font-semibold text-slate-900">
                            {b.service_title}{' '}
                            <span className="font-mono font-medium text-slate-700 tabular-nums">
                              ({formatPrice(b.total_price_cents)})
                            </span>
                          </h3>
                          <p className="text-sm text-slate-700">
                            Customer: <span className="font-medium">{b.customer_name}</span> ({b.customer_phone} ·{' '}
                            {b.customer_email})
                          </p>
                          <p className="text-xs text-slate-500">
                            Location: {b.service_address} {b.notes ? `· Notes: ${b.notes}` : ''}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {b.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleBookingStatus(b.id, 'confirmed')}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-800"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                Accept Request
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleBookingStatus(b.id, 'declined')}
                                className="rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                              >
                                Decline
                              </button>
                            </>
                          )}
                          {b.status === 'confirmed' && (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleBookingStatus(b.id, 'completed')}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                Mark Completed
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleBookingStatus(b.id, 'declined')}
                                className="rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                              >
                                Decline
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Tab 2: Availability */}
            {tab === 'availability' && (
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
                <form
                  onSubmit={handleAddSingleSlot}
                  className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-6 space-y-4"
                >
                  <h2 className="font-display text-lg font-semibold text-slate-900">
                    Add Open Time Slots
                  </h2>
                  <p className="text-xs text-slate-500">
                    Customers can only book open, unblocked slots. Booked or blocked slots cannot be double-booked.
                  </p>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-700">Date</span>
                    <input
                      type="date"
                      required
                      value={slotDate}
                      onChange={(e) => setSlotDate(e.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-slate-700">Start Time</span>
                      <input
                        type="time"
                        required
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-slate-700">End Time</span>
                      <input
                        type="time"
                        required
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add Time Slot
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleAddStandardDay()}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100"
                  >
                    Add 4 Standard Slots for {formatDateReadable(slotDate)}
                  </button>
                </form>

                <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
                    <h2 className="font-display text-base font-semibold text-slate-900">
                      Scheduled Slots
                    </h2>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {dashboard.slots.length} slots
                    </span>
                  </div>

                  {dashboard.slots.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-600">
                      No availability slots configured yet. Add a slot on the left.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
                      {dashboard.slots.map((slot) => {
                        const isBooked = slot.is_booked === 1;
                        const isBlocked = slot.is_blocked === 1;
                        return (
                          <div
                            key={slot.id}
                            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-5 py-3 text-sm"
                          >
                            <div className="flex flex-wrap items-center gap-3 tabular-nums">
                              <Calendar className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                              <span className="font-medium text-slate-900">
                                {formatDateReadable(slot.slot_date)}
                              </span>
                              <span className="text-slate-600">
                                {formatTime24to12(slot.start_time)} – {formatTime24to12(slot.end_time)}
                              </span>
                              <span
                                className={`text-xs font-medium ${
                                  isBooked
                                    ? 'text-teal-800'
                                    : isBlocked
                                      ? 'text-amber-800'
                                      : 'text-slate-500'
                                }`}
                              >
                                {isBooked
                                  ? `Booked (${slot.booking_reference || 'Active'})`
                                  : isBlocked
                                    ? 'Blocked / Unavailable'
                                    : 'Open'}
                              </span>
                            </div>

                            {!isBooked && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleToggleBlockSlot(slot)}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  {isBlocked ? (
                                    <>
                                      <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
                                      Unblock
                                    </>
                                  ) : (
                                    <>
                                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                                      Block
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteSlot(slot.id)}
                                  className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Services */}
            {tab === 'services' && (
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
                <form
                  onSubmit={handleSaveService}
                  className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg font-semibold text-slate-900">
                      {editingServiceId ? 'Edit Service' : 'Add New Service'}
                    </h2>
                    {editingServiceId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingServiceId(null);
                          setSvcTitle('');
                          setSvcDescription('');
                        }}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-700">Category</span>
                    <select
                      value={svcCategoryId}
                      onChange={(e) => setSvcCategoryId(Number(e.target.value))}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-700">Service Title</span>
                    <input
                      type="text"
                      required
                      value={svcTitle}
                      onChange={(e) => setSvcTitle(e.target.value)}
                      placeholder="e.g. Kitchen Mixer Tap Replacement"
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-700">Description</span>
                    <textarea
                      required
                      rows={3}
                      value={svcDescription}
                      onChange={(e) => setSvcDescription(e.target.value)}
                      placeholder="Describe what is included in the flat rate."
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                  </label>

                  <div className="grid grid-cols-3 gap-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-slate-700">Price (₹)</span>
                      <input
                        type="number"
                        required
                        min={50}
                        max={200000}
                        step="1"
                        value={svcPriceDollars}
                        onChange={(e) => setSvcPriceDollars(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none tabular-nums"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-slate-700">Minutes</span>
                      <input
                        type="number"
                        required
                        min={15}
                        max={480}
                        step={15}
                        value={svcDuration}
                        onChange={(e) => setSvcDuration(e.target.value)}
                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none tabular-nums"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-slate-700">Mode</span>
                      <select
                        value={svcMode}
                        onChange={(e) => setSvcMode(e.target.value as ServiceMode)}
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                      >
                        <option value="in_person">In-person</option>
                        <option value="remote">Remote</option>
                        <option value="both">Both</option>
                      </select>
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
                  >
                    {editingServiceId ? 'Save Changes' : 'Add Service Listing'}
                  </button>
                </form>

                <div className="lg:col-span-7 space-y-3">
                  <h2 className="font-display text-lg font-semibold text-slate-900">
                    Your Service Listings
                  </h2>
                  {dashboard.services.filter((s) => s.is_active !== 0).length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
                      No active services listed yet. Add your first service on the left.
                    </div>
                  ) : (
                    dashboard.services
                      .filter((s) => s.is_active !== 0)
                      .map((svc) => (
                        <div
                          key={svc.id}
                          className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <div className="space-y-1">
                            <div className="text-xs text-slate-500">
                              {svc.category_name} · {svc.duration_minutes} min ·{' '}
                              {svc.service_mode === 'both'
                                ? 'In-person & Remote'
                                : svc.service_mode === 'remote'
                                  ? 'Remote'
                                  : 'In-person'}
                            </div>
                            <h3 className="font-display text-base font-semibold text-slate-900">
                              {svc.title}
                            </h3>
                            <p className="text-sm text-slate-600">{svc.description}</p>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                            <span className="font-mono text-base font-semibold text-slate-900 tabular-nums">
                              {formatPrice(svc.price_cents)}
                            </span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingServiceId(svc.id);
                                  setSvcCategoryId(svc.category_id);
                                  setSvcTitle(svc.title);
                                  setSvcDescription(svc.description);
                                  setSvcPriceDollars(String(svc.price_cents / 100));
                                  setSvcDuration(String(svc.duration_minutes));
                                  setSvcMode(svc.service_mode);
                                }}
                                className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteService(svc.id)}
                                className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}

            {/* Tab 4: Profile Settings */}
            {tab === 'profile' && (
              <form
                onSubmit={handleSaveProfile}
                className="max-w-3xl rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-5"
              >
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Public Provider Profile
                </h2>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-700">Display Name</span>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-700">Business Name</span>
                    <input
                      type="text"
                      required
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-700">Headline</span>
                  <input
                    type="text"
                    required
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-700">About / Bio</span>
                  <textarea
                    required
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-700">City</span>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-700">Service Area / Neighborhoods</span>
                    <input
                      type="text"
                      required
                      value={serviceArea}
                      onChange={(e) => setServiceArea(e.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-700">Service Mode</span>
                    <select
                      value={serviceMode}
                      onChange={(e) => setServiceMode(e.target.value as ServiceMode)}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                    >
                      <option value="in_person">In-Person Only</option>
                      <option value="remote">Remote Only</option>
                      <option value="both">Both In-Person &amp; Remote</option>
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-700">Years of Experience</span>
                    <input
                      type="number"
                      min={0}
                      max={70}
                      required
                      value={yearsExperience}
                      onChange={(e) => setYearsExperience(Number(e.target.value))}
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none tabular-nums"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors"
                >
                  Save Profile Changes
                </button>
              </form>
            )}
          </>
        )
      )}
    </div>
  );
}
