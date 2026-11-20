import { Calendar, CheckCircle2, Clock, MapPin, Star, XCircle, AlertCircle } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { apiRequest, formatDateReadable, formatPrice, formatTime24to12 } from '../lib/api';
import type { AuthUser, AvailabilitySlot, BookingItem, BookingStatus } from '../types';

interface CustomerBookingsViewProps {
  user: AuthUser | null;
  onRequireAuth: () => void;
  onBrowsePros: () => void;
  onSelectProvider: (providerId: number) => void;
}

function StatusLabel({ status }: { status: BookingStatus }) {
  const styles: Record<BookingStatus, { cls: string; label: string; Icon: typeof Clock }> = {
    pending: { cls: 'text-amber-800 bg-amber-50 border-amber-200', label: 'Pending Confirmation', Icon: Clock },
    confirmed: { cls: 'text-teal-800 bg-teal-50 border-teal-200', label: 'Confirmed', Icon: CheckCircle2 },
    completed: { cls: 'text-slate-800 bg-slate-100 border-slate-200', label: 'Completed', Icon: CheckCircle2 },
    cancelled: { cls: 'text-slate-600 bg-slate-50 border-slate-200', label: 'Cancelled', Icon: XCircle },
    declined: { cls: 'text-red-800 bg-red-50 border-red-200', label: 'Declined', Icon: AlertCircle },
  };
  const { cls, label, Icon } = styles[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${cls}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function CustomerBookingsView({
  user,
  onRequireAuth,
  onBrowsePros,
  onSelectProvider,
}: CustomerBookingsViewProps) {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed' | 'closed'>('all');

  // Reschedule modal state
  const [rescheduleTarget, setRescheduleTarget] = useState<BookingItem | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Cancel modal state
  const [cancelTarget, setCancelTarget] = useState<BookingItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Review state
  const [reviewTarget, setReviewTarget] = useState<BookingItem | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const loadBookings = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ bookings: BookingItem[] }>('/api/bookings');
      setBookings(res.bookings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your bookings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      void loadBookings();
    } else {
      setBookings([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (filter === 'upcoming') return b.status === 'pending' || b.status === 'confirmed';
      if (filter === 'completed') return b.status === 'completed';
      if (filter === 'closed') return b.status === 'cancelled' || b.status === 'declined';
      return true;
    });
  }, [bookings, filter]);

  const openReschedule = async (booking: BookingItem) => {
    setRescheduleTarget(booking);
    setSelectedSlotId(null);
    setActionError(null);
    setSlotsLoading(true);
    try {
      const res = await apiRequest<{ slots: AvailabilitySlot[] }>(
        `/api/providers/${booking.provider_id}/availability`
      );
      setAvailableSlots(res.slots);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to load open slots.');
    } finally {
      setSlotsLoading(false);
    }
  };

  const confirmReschedule = async () => {
    if (!rescheduleTarget || !selectedSlotId) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await apiRequest(`/api/bookings/${rescheduleTarget.id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify({ slotId: selectedSlotId }),
      });
      setRescheduleTarget(null);
      await loadBookings();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reschedule booking.');
    } finally {
      setActionBusy(false);
    }
  };

  const confirmCancel = async (e: FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await apiRequest(`/api/bookings/${cancelTarget.id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      setCancelTarget(null);
      setCancelReason('');
      await loadBookings();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to cancel booking.');
    } finally {
      setActionBusy(false);
    }
  };

  const submitReview = async (e: FormEvent) => {
    e.preventDefault();
    if (!reviewTarget) return;
    setActionBusy(true);
    setActionError(null);
    try {
      await apiRequest('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: reviewTarget.id,
          rating: reviewRating,
          comment: reviewComment.trim(),
        }),
      });
      setReviewTarget(null);
      setReviewComment('');
      setReviewRating(5);
      await loadBookings();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to submit review.');
    } finally {
      setActionBusy(false);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center space-y-5">
        <h1 className="font-display text-2xl font-bold text-slate-900">Your Service Bookings</h1>
        <p className="text-sm sm:text-base text-slate-600">
          Sign in to view your confirmed appointments, reschedule times, cancel bookings, or leave a review.
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={onRequireAuth}
            className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={onBrowsePros}
            className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Browse Pros
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-8 pb-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">My Bookings</h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage upcoming appointments, reschedule times, or review completed work.
          </p>
        </div>
        <button
          type="button"
          onClick={onBrowsePros}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 transition-colors self-start sm:self-auto"
        >
          Book New Service
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
        {(
          [
            ['all', 'All'],
            ['upcoming', 'Upcoming'],
            ['completed', 'Completed'],
            ['closed', 'Cancelled / Declined'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              filter === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between gap-4">
          <span className="text-sm text-red-900">{error}</span>
          <button
            type="button"
            onClick={() => void loadBookings()}
            className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-36 rounded-xl border border-slate-200 bg-white animate-pulse" />
          ))}
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center space-y-3">
          <h2 className="font-display text-lg font-semibold text-slate-900">No bookings in this view</h2>
          <p className="text-sm text-slate-600">
            Explore local plumbers, electricians, cleaners, tutors, and appliance technicians to book an appointment.
          </p>
          <button
            type="button"
            onClick={onBrowsePros}
            className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
          >
            Browse Professionals
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((b) => {
            const canModify = b.status === 'pending' || b.status === 'confirmed';
            const canReview = b.status === 'completed' && !b.review_id;

            return (
              <article
                key={b.id}
                className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {b.reference_code}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{b.category_name}</span>
                      <span aria-hidden="true">·</span>
                      <span>{b.service_mode === 'remote' ? 'Remote' : 'In-person'}</span>
                    </div>
                    <h2 className="font-display text-lg font-semibold text-slate-900">
                      {b.service_title}
                    </h2>
                    <button
                      type="button"
                      onClick={() => onSelectProvider(b.provider_id)}
                      className="text-sm font-medium text-teal-700 hover:underline text-left"
                    >
                      {b.provider_name} · {b.provider_business}
                    </button>
                  </div>

                  <div className="flex flex-col sm:items-end gap-2">
                    <StatusLabel status={b.status} />
                    <span className="font-mono text-base font-semibold text-slate-900 tabular-nums">
                      {formatPrice(b.total_price_cents)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
                  <div className="inline-flex items-center gap-2 tabular-nums">
                    <Calendar className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                    <span>
                      {formatDateReadable(b.booking_date)} · {formatTime24to12(b.start_time)} –{' '}
                      {formatTime24to12(b.end_time)}
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                    <span className="truncate">{b.service_address || 'Remote session'}</span>
                  </div>
                </div>

                {b.notes && (
                  <p className="text-xs text-slate-500">
                    Notes: {b.notes}
                  </p>
                )}

                {b.cancellation_reason && (b.status === 'cancelled' || b.status === 'declined') && (
                  <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                    Reason: {b.cancellation_reason}
                  </p>
                )}

                {b.review_id && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
                    <div className="font-semibold text-slate-900 inline-flex items-center gap-1 tabular-nums">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden="true" />
                      Your Review: {b.review_rating}.0 / 5
                    </div>
                    <p>{b.review_comment}</p>
                  </div>
                )}

                {(canModify || canReview) && (
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
                    {canModify && (
                      <>
                        <button
                          type="button"
                          onClick={() => void openReschedule(b)}
                          className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors"
                        >
                          Reschedule
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCancelTarget(b);
                            setCancelReason('');
                            setActionError(null);
                          }}
                          className="rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
                        >
                          Cancel Booking
                        </button>
                      </>
                    )}
                    {canReview && (
                      <button
                        type="button"
                        onClick={() => {
                          setReviewTarget(b);
                          setReviewRating(5);
                          setReviewComment('');
                          setActionError(null);
                        }}
                        className="rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-teal-800 transition-colors"
                      >
                        Leave a Review
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Reschedule {rescheduleTarget.reference_code}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Pick a new available time slot with {rescheduleTarget.provider_name}. Your previous slot will be released automatically.
              </p>
            </div>

            {slotsLoading ? (
              <div className="py-8 text-center text-sm text-slate-500">Loading open slots...</div>
            ) : availableSlots.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No other open slots are currently available for this provider.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {availableSlots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={`rounded-lg border p-3 text-left text-xs transition-colors tabular-nums ${
                      selectedSlotId === slot.id
                        ? 'border-teal-700 bg-teal-50 text-teal-950 font-semibold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="font-semibold">{formatDateReadable(slot.slot_date)}</div>
                    <div>
                      {formatTime24to12(slot.start_time)} – {formatTime24to12(slot.end_time)}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {actionError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {actionError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                disabled={!selectedSlotId || actionBusy}
                onClick={() => void confirmReschedule()}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-500"
              >
                {actionBusy ? 'Saving...' : 'Confirm New Time'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <form
            onSubmit={confirmCancel}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 space-y-4"
          >
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Cancel Booking {cancelTarget.reference_code}?
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {cancelTarget.service_title} on {formatDateReadable(cancelTarget.booking_date)} at{' '}
                {formatTime24to12(cancelTarget.start_time)}.
              </p>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Reason (optional)</span>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Schedule conflict or no longer needed"
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </label>

            {actionError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {actionError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Keep Booking
              </button>
              <button
                type="submit"
                disabled={actionBusy}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
              >
                {actionBusy ? 'Cancelling...' : 'Cancel Booking'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Review Modal */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
          <form
            onSubmit={submitReview}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 space-y-4"
          >
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Review {reviewTarget.provider_name}
              </h2>
              <p className="text-xs text-slate-500 mt-1">{reviewTarget.service_title}</p>
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-slate-700">Rating</span>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setReviewRating(num)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold tabular-nums ${
                      reviewRating === num
                        ? 'border-amber-500 bg-amber-50 text-amber-900'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {num} ★
                  </button>
                ))}
              </div>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Your Feedback</span>
              <textarea
                required
                rows={3}
                minLength={5}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share how punctual, clear, and helpful the service was."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </label>

            {actionError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {actionError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReviewTarget(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionBusy}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {actionBusy ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
