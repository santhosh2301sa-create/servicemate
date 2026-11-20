import { ArrowLeft, Calendar, CheckCircle2, Clock, MapPin, Star } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  apiRequest,
  formatDateReadable,
  formatPrice,
  formatServiceModeLabel,
  formatTime24to12,
} from '../lib/api';
import type { AuthUser, AvailabilitySlot, BookingItem, ProviderDetailResponse, ServiceItem } from '../types';
import { SafeImage } from './SafeImage';

interface ProviderDetailViewProps {
  providerId: number;
  user: AuthUser | null;
  onBack: () => void;
  onRequireAuth: () => void;
  onBookingCreated: () => void;
}

export function ProviderDetailView({
  providerId,
  user,
  onBack,
  onRequireAuth,
  onBookingCreated,
}: ProviderDetailViewProps) {
  const [detail, setDetail] = useState<ProviderDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guided booking states
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [bookingMode, setBookingMode] = useState<'in_person' | 'remote'>('in_person');
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [serviceAddress, setServiceAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [reviewStep, setReviewStep] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingItem | null>(null);

  useEffect(() => {
    if (user) {
      setCustomerName((prev) => prev || user.name);
      setCustomerEmail((prev) => prev || user.email);
      setCustomerPhone((prev) => prev || user.phone || '');
    }
  }, [user]);

  const loadProvider = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<ProviderDetailResponse>(`/api/providers/${providerId}`);
      setDetail(res);
      if (res.services.length > 0 && selectedServiceId === null) {
        setSelectedServiceId(res.services[0].id);
        setBookingMode(res.services[0].service_mode === 'remote' ? 'remote' : 'in_person');
      }
      if (res.slots.length > 0 && !selectedDate) {
        setSelectedDate(res.slots[0].slot_date);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load provider details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProvider();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  const selectedService: ServiceItem | undefined = useMemo(
    () => detail?.services.find((s) => s.id === selectedServiceId),
    [detail, selectedServiceId]
  );

  const uniqueDates = useMemo(() => {
    if (!detail) return [];
    const set = new Set(detail.slots.map((s) => s.slot_date));
    return Array.from(set);
  }, [detail]);

  const slotsForSelectedDate: AvailabilitySlot[] = useMemo(() => {
    if (!detail || !selectedDate) return [];
    return detail.slots.filter((s) => s.slot_date === selectedDate);
  }, [detail, selectedDate]);

  const selectedSlot: AvailabilitySlot | undefined = useMemo(
    () => detail?.slots.find((s) => s.id === selectedSlotId),
    [detail, selectedSlotId]
  );

  const handleSelectService = (svc: ServiceItem) => {
    setSelectedServiceId(svc.id);
    setBookingMode(svc.service_mode === 'remote' ? 'remote' : 'in_person');
    setSubmitError(null);
    setReviewStep(false);
  };

  const handleProceedToReview = (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!selectedService) {
      setSubmitError('Please select a service first.');
      return;
    }
    if (!selectedSlot) {
      setSubmitError('Please choose a date and available time slot.');
      return;
    }
    if (!customerName.trim() || !customerEmail.trim() || customerPhone.trim().length < 7) {
      setSubmitError('Please complete your name, email, and a valid phone number.');
      return;
    }
    if (bookingMode === 'in_person' && serviceAddress.trim().length < 5) {
      setSubmitError('Please enter your full street address for an in-person visit.');
      return;
    }
    setReviewStep(true);
  };

  const handleConfirmBooking = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!selectedService || !selectedSlot) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await apiRequest<{ booking: BookingItem }>('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          providerId,
          serviceId: selectedService.id,
          slotId: selectedSlot.id,
          serviceMode: bookingMode,
          serviceAddress: bookingMode === 'remote' ? 'Remote Video Session' : serviceAddress.trim(),
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim(),
          notes: notes.trim(),
        }),
      });
      setConfirmedBooking(res.booking);
      setReviewStep(false);
      await loadProvider();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to complete booking.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">
        <div className="h-5 w-40 rounded bg-slate-200 animate-pulse" />
        <div className="h-44 rounded-xl bg-white border border-slate-200 animate-pulse" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7 h-72 rounded-xl bg-white border border-slate-200 animate-pulse" />
          <div className="lg:col-span-5 h-96 rounded-xl bg-white border border-slate-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center space-y-4">
        <p className="text-base font-medium text-red-700">{error || 'Provider could not be found.'}</p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to professionals
        </button>
      </div>
    );
  }

  const { provider, services, reviews } = detail;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 pb-16">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to all professionals
      </button>

      {/* Provider Profile Banner */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <SafeImage
            src={provider.avatar_url}
            alt={`${provider.display_name} portrait`}
            className="h-24 w-24 sm:h-28 sm:w-28 rounded-xl object-cover shrink-0 border border-slate-200"
            fallbackTitle={provider.display_name}
          />
          <div className="flex-1 space-y-3">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
                {provider.display_name}
              </h1>
              <p className="text-base font-medium text-slate-700">{provider.business_name}</p>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1 font-medium text-slate-900 tabular-nums">
                <Star className="h-4 w-4 fill-amber-400 text-amber-500" aria-hidden="true" />
                {provider.review_count > 0 ? provider.avg_rating.toFixed(1) : 'New'} ({provider.review_count}{' '}
                {provider.review_count === 1 ? 'review' : 'reviews'})
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />
                {provider.city} ({provider.service_area})
              </span>
              <span aria-hidden="true">·</span>
              <span>{formatServiceModeLabel(provider.service_mode)}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{provider.years_experience} years experience</span>
            </div>

            <p className="max-w-3xl text-sm sm:text-base leading-relaxed text-slate-600">{provider.bio}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Left Column: Services & Reviews */}
        <div className="lg:col-span-7 space-y-10">
          {/* Services Selection */}
          <section className="space-y-4">
            <h2 className="font-display text-xl font-semibold text-slate-900">
              1. Services &amp; Upfront Pricing
            </h2>

            {services.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                This provider has not published active services yet.
              </div>
            ) : (
              <div className="space-y-3">
                {services.map((svc) => {
                  const isSelected = svc.id === selectedServiceId;
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => handleSelectService(svc)}
                      className={`w-full text-left rounded-xl border p-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                        isSelected
                          ? 'border-teal-700 bg-teal-50/40'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-slate-500">
                            {svc.category_name} · {formatServiceModeLabel(svc.service_mode)}
                          </div>
                          <h3 className="font-display text-base font-semibold text-slate-900">
                            {svc.title}
                          </h3>
                        </div>
                        <div className="sm:text-right shrink-0">
                          <div className="font-mono text-base font-semibold text-slate-900 tabular-nums">
                            {formatPrice(svc.price_cents)}
                          </div>
                          <div className="inline-flex items-center gap-1 text-xs text-slate-500 tabular-nums">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            {svc.duration_minutes} min
                          </div>
                        </div>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">{svc.description}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Customer Reviews */}
          <section className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl font-semibold text-slate-900">
                Customer Reviews
              </h2>
              <span className="text-sm text-slate-500 tabular-nums">
                {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
              </span>
            </div>

            {reviews.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                No reviews yet. Reviews can be submitted by customers after a completed booking.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                {reviews.map((rev) => (
                  <div key={rev.id} className="p-5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900">
                        {rev.customer_name}
                        <span className="ml-2 font-normal text-xs text-slate-500">
                          · {rev.service_title}
                        </span>
                      </div>
                      <div className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 tabular-nums">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden="true" />
                        {rev.rating}.0
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600">{rev.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Guided Booking Panel */}
        <aside className="lg:col-span-5 lg:sticky lg:top-24">
          {confirmedBooking ? (
            <div className="rounded-xl border border-teal-200 bg-white p-6 space-y-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h2 className="font-display text-xl font-bold text-slate-900">
                    Booking Request Submitted
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Your slot is reserved and awaiting provider confirmation.
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Reference Number</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {confirmedBooking.reference_code}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Service</span>
                  <span className="font-medium text-slate-900">{confirmedBooking.service_title}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Date &amp; Time</span>
                  <span className="font-medium text-slate-900 tabular-nums">
                    {formatDateReadable(confirmedBooking.booking_date)} ·{' '}
                    {formatTime24to12(confirmedBooking.start_time)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Estimated Total</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {formatPrice(confirmedBooking.total_price_cents)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Demo note: No payment was charged and no external email or SMS was sent. You can manage, reschedule, or cancel this booking in My Bookings.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={onBookingCreated}
                  className="flex-1 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors"
                >
                  View My Bookings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmedBooking(null);
                    setSelectedSlotId(null);
                    setNotes('');
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Book Another
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Schedule a Booking
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedService
                    ? `${selectedService.title} · ${formatPrice(selectedService.price_cents)}`
                    : 'Choose a service on the left to begin.'}
                </p>
              </div>

              {/* Step 2: Date & Time Slots */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  2. Select Date &amp; Available Time
                </h3>

                {uniqueDates.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                    No open time slots are currently listed for this provider.
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {uniqueDates.map((dateStr) => (
                        <button
                          key={dateStr}
                          type="button"
                          onClick={() => {
                            setSelectedDate(dateStr);
                            setSelectedSlotId(null);
                            setReviewStep(false);
                          }}
                          className={`rounded-lg border px-3 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                            selectedDate === dateStr
                              ? 'border-teal-700 bg-teal-700 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {formatDateReadable(dateStr)}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {slotsForSelectedDate.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => {
                            setSelectedSlotId(slot.id);
                            setReviewStep(false);
                            setSubmitError(null);
                          }}
                          className={`rounded-lg border px-3 py-2 text-xs font-medium tabular-nums transition-colors ${
                            selectedSlotId === slot.id
                              ? 'border-teal-700 bg-teal-50 text-teal-900 font-semibold'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          {formatTime24to12(slot.start_time)} – {formatTime24to12(slot.end_time)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Step 3: Contact Details or Review Step */}
              {!reviewStep ? (
                <form onSubmit={handleProceedToReview} className="space-y-4 pt-2 border-t border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900">
                    3. Contact &amp; Location Details
                  </h3>

                  {selectedService?.service_mode === 'both' && (
                    <div className="space-y-1.5">
                      <span className="block text-xs font-medium text-slate-700">Service Mode</span>
                      <div className="grid grid-cols-2 gap-2">
                        {(['in_person', 'remote'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setBookingMode(m)}
                            className={`rounded-lg border py-2 text-xs font-medium ${
                              bookingMode === m
                                ? 'border-teal-700 bg-teal-50 text-teal-900'
                                : 'border-slate-200 text-slate-700'
                            }`}
                          >
                            {m === 'in_person' ? 'In-Person Visit' : 'Remote Session'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-slate-700">Full Name</span>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Aarav Mehta"
                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-slate-700">Phone</span>
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="+91 98450 24180"
                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                      />
                    </label>
                  </div>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-700">Email</span>
                    <input
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                  </label>

                  {bookingMode === 'in_person' && (
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-slate-700">Service Address</span>
                      <input
                        type="text"
                        required
                        value={serviceAddress}
                        onChange={(e) => setServiceAddress(e.target.value)}
                        placeholder="Flat / House #, street, locality, city"
                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                      />
                    </label>
                  )}

                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-slate-700">Notes for the pro (optional)</span>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Parking instructions, model number, or helpful context"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                  </label>

                  {submitError && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
                      {submitError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={!selectedService || !selectedSlot}
                    className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-500 transition-colors"
                  >
                    Review Booking Request
                  </button>
                </form>
              ) : (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Review &amp; Submit Request
                  </h3>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Service</span>
                      <span className="font-semibold text-slate-900">{selectedService?.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Schedule</span>
                      <span className="font-medium text-slate-900 tabular-nums">
                        {selectedSlot ? `${formatDateReadable(selectedSlot.slot_date)} · ${formatTime24to12(selectedSlot.start_time)}` : ''}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Location</span>
                      <span className="font-medium text-slate-900 truncate max-w-[60%]">
                        {bookingMode === 'remote' ? 'Remote Video Session' : serviceAddress}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-200">
                      <span className="font-semibold text-slate-900">Listed Service Price</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {formatPrice(selectedService?.price_cents)}
                      </span>
                    </div>
                  </div>

                  {!user && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-2">
                      <p className="font-medium">Sign in required to confirm your reservation.</p>
                      <button
                        type="button"
                        onClick={onRequireAuth}
                        className="rounded-md bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-950"
                      >
                        Sign In / Create Customer Account
                      </button>
                    </div>
                  )}

                  {submitError && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
                      {submitError}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setReviewStep(false)}
                      className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={submitting || !user}
                      onClick={() => void handleConfirmBooking()}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-500 transition-colors"
                    >
                      <Calendar className="h-4 w-4" aria-hidden="true" />
                      {submitting ? 'Submitting...' : 'Confirm Booking Request'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
