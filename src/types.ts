export type UserRole = 'customer' | 'provider' | 'admin';
export type ServiceMode = 'in_person' | 'remote' | 'both';
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'declined';

export interface ProviderProfileRecord {
  id: number;
  user_id: number;
  display_name: string;
  business_name: string;
  headline: string;
  bio: string;
  service_area: string;
  city: string;
  service_mode: ServiceMode;
  years_experience: number;
  avatar_url: string;
  is_active: number;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  createdAt?: string;
  providerProfile: ProviderProfileRecord | null;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  provider_count?: number;
  service_count?: number;
  is_active?: number;
}

export interface ProviderSummary {
  id: number;
  display_name: string;
  business_name: string;
  headline: string;
  bio: string;
  service_area: string;
  city: string;
  service_mode: ServiceMode;
  years_experience: number;
  avatar_url: string;
  avg_rating: number;
  review_count: number;
  min_price_cents: number | null;
  service_count: number;
  category_names: string | null;
  next_available_slot: string | null;
  open_slot_count: number;
}

export interface ServiceItem {
  id: number;
  provider_id: number;
  category_id: number;
  category_name: string;
  category_slug?: string;
  title: string;
  description: string;
  price_cents: number;
  duration_minutes: number;
  service_mode: ServiceMode;
  is_active?: number;
}

export interface AvailabilitySlot {
  id: number;
  provider_id?: number;
  slot_date: string;
  start_time: string;
  end_time: string;
  is_booked?: number;
  is_blocked?: number;
  booking_reference?: string | null;
  booking_status?: string | null;
}

export interface ReviewItem {
  id: number;
  rating: number;
  comment: string;
  created_at: string;
  customer_name: string;
  service_title: string;
}

export interface ProviderDetailResponse {
  provider: ProviderSummary;
  services: ServiceItem[];
  slots: AvailabilitySlot[];
  reviews: ReviewItem[];
}

export interface BookingItem {
  id: number;
  reference_code: string;
  customer_id: number;
  provider_id: number;
  service_id: number;
  slot_id: number | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  service_mode: 'in_person' | 'remote';
  service_address: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string;
  total_price_cents: number;
  status: BookingStatus;
  cancellation_reason: string;
  created_at: string;
  updated_at: string;
  provider_name?: string;
  provider_business?: string;
  provider_avatar?: string;
  provider_city?: string;
  service_title?: string;
  service_duration?: number;
  category_name?: string;
  review_id?: number | null;
  review_rating?: number | null;
  review_comment?: string | null;
}
