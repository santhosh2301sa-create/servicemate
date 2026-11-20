-- ServiceMate SQLite Schema & Migrations
-- Tables: users, categories, provider_profiles, services, availability_slots, bookings, reviews

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'provider', 'admin')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS provider_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  headline TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  service_area TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  service_mode TEXT NOT NULL DEFAULT 'in_person' CHECK (service_mode IN ('in_person', 'remote', 'both')),
  years_experience INTEGER NOT NULL DEFAULT 1,
  avatar_url TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 15 AND duration_minutes <= 480),
  service_mode TEXT NOT NULL DEFAULT 'in_person' CHECK (service_mode IN ('in_person', 'remote', 'both')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (provider_id) REFERENCES provider_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS availability_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  slot_date TEXT NOT NULL, -- YYYY-MM-DD
  start_time TEXT NOT NULL, -- HH:MM (24h)
  end_time TEXT NOT NULL,   -- HH:MM (24h)
  is_booked INTEGER NOT NULL DEFAULT 0,
  is_blocked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider_id, slot_date, start_time),
  FOREIGN KEY (provider_id) REFERENCES provider_profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference_code TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL,
  provider_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  slot_id INTEGER,
  booking_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  service_mode TEXT NOT NULL CHECK (service_mode IN ('in_person', 'remote')),
  service_address TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  total_price_cents INTEGER NOT NULL CHECK (total_price_cents >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'declined')),
  cancellation_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (provider_id) REFERENCES provider_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT,
  FOREIGN KEY (slot_id) REFERENCES availability_slots(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL,
  provider_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (provider_id) REFERENCES provider_profiles(id) ON DELETE CASCADE
);

-- Prevent duplicate active bookings for the same provider, date, and start time
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking
  ON bookings(provider_id, booking_date, start_time)
  WHERE status IN ('pending', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_services_provider ON services(provider_id, is_active);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_slots_provider_date ON availability_slots(provider_id, slot_date, is_booked, is_blocked);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings(provider_id, status);
CREATE INDEX IF NOT EXISTS idx_reviews_provider ON reviews(provider_id);
