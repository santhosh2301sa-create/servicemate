import { Calendar, MapPin, Search, SlidersHorizontal, Star, RotateCcw } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest, formatDateReadable, formatPrice, formatServiceModeLabel, formatTime24to12 } from '../lib/api';
import type { Category, ProviderSummary } from '../types';
import { SafeImage } from './SafeImage';

interface MarketplaceViewProps {
  onSelectProvider: (providerId: number) => void;
}

export function MarketplaceView({ onSelectProvider }: MarketplaceViewProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchInput, setSearchInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [appliedLocation, setAppliedLocation] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [serviceMode, setServiceMode] = useState<'all' | 'in_person' | 'remote'>('all');
  const [maxPrice, setMaxPrice] = useState('');
  const [minRating, setMinRating] = useState('');
  const [availableDate, setAvailableDate] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sortBy, setSortBy] = useState('rating');

  useEffect(() => {
    apiRequest<{ categories: Category[] }>('/api/categories')
      .then((res) => setCategories(res.categories))
      .catch(() => {
        // Categories retry handled via main reload if needed
      });
  }, []);

  const fetchProviders = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (appliedQuery) params.set('q', appliedQuery);
      if (appliedLocation) params.set('location', appliedLocation);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (serviceMode !== 'all') params.set('mode', serviceMode);
      if (maxPrice) params.set('maxPrice', maxPrice);
      if (minRating) params.set('minRating', minRating);
      if (availableDate) params.set('availableDate', availableDate);
      if (availableOnly) params.set('availableOnly', 'true');
      if (sortBy) params.set('sort', sortBy);

      const res = await apiRequest<{ providers: ProviderSummary[] }>(`/api/providers?${params.toString()}`);
      setProviders(res.providers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load local service providers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedQuery, appliedLocation, selectedCategory, serviceMode, maxPrice, minRating, availableDate, availableOnly, sortBy]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setAppliedQuery(searchInput.trim());
    setAppliedLocation(locationInput.trim());
  };

  const resetFilters = () => {
    setSearchInput('');
    setLocationInput('');
    setAppliedQuery('');
    setAppliedLocation('');
    setSelectedCategory('all');
    setServiceMode('all');
    setMaxPrice('');
    setMinRating('');
    setAvailableDate('');
    setAvailableOnly(false);
    setSortBy('rating');
  };

  const hasActiveFilters =
    Boolean(appliedQuery) ||
    Boolean(appliedLocation) ||
    selectedCategory !== 'all' ||
    serviceMode !== 'all' ||
    Boolean(maxPrice) ||
    Boolean(minRating) ||
    Boolean(availableDate) ||
    availableOnly;

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Section: Asymmetric 2-Column Split */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
            <div className="flex flex-col justify-center lg:col-span-7 space-y-6">
              <div className="space-y-4">
                <p className="text-sm font-medium text-teal-700">
                  Local home, repair &amp; tutoring professionals
                </p>
                <h1 className="font-display text-[clamp(2.15rem,4vw,3.35rem)] font-bold leading-[1.1] tracking-tight text-slate-900 text-balance">
                  Book dependable local specialists with upfront scheduling.
                </h1>
                <p className="max-w-2xl text-base leading-relaxed text-slate-600">
                  Compare transparent service prices, read real customer feedback, and reserve an open time slot with plumbers, electricians, cleaners, tutors, and appliance repair technicians.
                </p>
              </div>

              <form
                onSubmit={handleSearchSubmit}
                className="rounded-xl border border-slate-200 bg-slate-50 p-2 sm:p-2.5"
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                  <label className="relative sm:col-span-5 flex items-center">
                    <span className="sr-only">Search service or provider</span>
                    <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Service or pro (e.g. mixer tap, tutor)"
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                    />
                  </label>

                  <label className="relative sm:col-span-4 flex items-center">
                    <span className="sr-only">Location or neighborhood</span>
                    <MapPin className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                    <input
                      type="text"
                      value={locationInput}
                      onChange={(e) => setLocationInput(e.target.value)}
                      placeholder="City or area (e.g. Indiranagar)"
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                    />
                  </label>

                  <button
                    type="submit"
                    className="h-11 sm:col-span-3 inline-flex items-center justify-center rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
                  >
                    Search Pros
                  </button>
                </div>
              </form>

              <p className="text-xs text-slate-500">
                Demo marketplace using fictional sample profiles and schedules. Payments, SMS/email notifications, and license checks are not connected.
              </p>
            </div>

            <div className="lg:col-span-5">
              <div className="h-64 sm:h-80 lg:h-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                <SafeImage
                  src="/src/assets/images/hero_servicemate_craft_1795208510011.jpg"
                  alt="Local service specialist inspecting modern residential fixtures"
                  className="h-full w-full object-cover"
                  fallbackTitle="ServiceMate Local Pros"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog & Filter Workspace */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Category Interactive Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.slug)}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                selectedCategory === cat.slug
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Filter Controls Toolbar */}
        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 pr-1">
              <SlidersHorizontal className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span>Filters</span>
            </div>

            {/* Service Mode Segmented Control */}
            <div className="inline-flex items-center rounded-lg bg-slate-100 p-1" role="group" aria-label="Service delivery mode">
              {(['all', 'in_person', 'remote'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setServiceMode(mode)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    serviceMode === mode
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {mode === 'all' ? 'All Modes' : mode === 'in_person' ? 'In-Person' : 'Remote'}
                </button>
              ))}
            </div>

            {/* Max Price Select */}
            <select
              aria-label="Maximum starting price"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none"
            >
              <option value="">Any price</option>
              <option value="600">Under ₹600</option>
              <option value="1000">Under ₹1,000</option>
              <option value="1500">Under ₹1,500</option>
              <option value="2500">Under ₹2,500</option>
            </select>

            {/* Min Rating Select */}
            <select
              aria-label="Minimum rating"
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none"
            >
              <option value="">Any rating</option>
              <option value="4.5">4.5+ stars</option>
              <option value="4.0">4.0+ stars</option>
              <option value="3.5">3.5+ stars</option>
            </select>

            {/* Specific Available Date */}
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <span>Date:</span>
              <input
                type="date"
                aria-label="Available on date"
                value={availableDate}
                onChange={(e) => setAvailableDate(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none"
              />
            </label>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={(e) => setAvailableOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
              />
              <span>Open slots only</span>
            </label>
          </div>

          <div className="flex items-center justify-between gap-3 lg:justify-end">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Reset filters
              </button>
            )}

            <select
              aria-label="Sort professionals"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none"
            >
              <option value="rating">Sort: Highest Rated</option>
              <option value="price_asc">Sort: Price Low to High</option>
              <option value="price_desc">Sort: Price High to Low</option>
              <option value="experience">Sort: Most Experienced</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-slate-900">
            Available Professionals
          </h2>
          {!loading && !error && (
            <span className="text-sm text-slate-500 tabular-nums">
              {providers.length} {providers.length === 1 ? 'provider' : 'providers'} found
            </span>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
            <p className="text-sm font-medium text-red-900">{error}</p>
            <button
              type="button"
              onClick={() => void fetchProviders()}
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && !error && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-lg bg-slate-200 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-2/3 rounded bg-slate-200" />
                    <div className="h-3 w-1/2 rounded bg-slate-200" />
                  </div>
                </div>
                <div className="h-3 w-full rounded bg-slate-200" />
                <div className="h-3 w-4/5 rounded bg-slate-200" />
                <div className="h-10 w-full rounded-lg bg-slate-200" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && providers.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center space-y-4">
            <h3 className="font-display text-lg font-semibold text-slate-900">
              No matching service professionals
            </h3>
            <p className="mx-auto max-w-md text-sm text-slate-600">
              Try broadening your location, clearing the date filter, or resetting your price and rating filters to see all available local pros.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800 transition-colors"
            >
              Reset All Filters
            </button>
          </div>
        )}

        {/* Provider Cards Grid */}
        {!loading && !error && providers.length > 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {providers.map((provider) => {
              const nextParts = provider.next_available_slot ? provider.next_available_slot.split(' ') : null;
              return (
                <article
                  key={provider.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 transition-colors hover:border-slate-300"
                >
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <SafeImage
                        src={provider.avatar_url}
                        alt={`${provider.display_name} portrait`}
                        className="h-16 w-16 rounded-lg object-cover shrink-0 border border-slate-200"
                        fallbackTitle={provider.display_name}
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-lg font-semibold text-slate-900 truncate">
                          {provider.display_name}
                        </h3>
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {provider.business_name}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600 tabular-nums">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500 shrink-0" aria-hidden="true" />
                          <span className="font-semibold text-slate-900">
                            {provider.review_count > 0 ? provider.avg_rating.toFixed(1) : 'New'}
                          </span>
                          <span>·</span>
                          <span>
                            {provider.review_count} {provider.review_count === 1 ? 'review' : 'reviews'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Clean unboxed inline metadata */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span>{provider.category_names?.split(',').join(' / ') || 'General Services'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{provider.city}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatServiceModeLabel(provider.service_mode)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{provider.years_experience} yrs exp</span>
                    </div>

                    <p className="text-sm leading-relaxed text-slate-600 line-clamp-2">
                      {provider.headline}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 space-y-4">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <div>
                        <span className="text-slate-500">Starting at </span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {formatPrice(provider.min_price_cents)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 tabular-nums">
                        <Calendar className="h-3.5 w-3.5 text-teal-700 shrink-0" aria-hidden="true" />
                        {nextParts ? (
                          <span>
                            Next: {formatDateReadable(nextParts[0])} · {formatTime24to12(nextParts[1])}
                          </span>
                        ) : (
                          <span className="text-slate-400">No open slots</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectProvider(provider.id)}
                      className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
                    >
                      View Profile &amp; Book
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
