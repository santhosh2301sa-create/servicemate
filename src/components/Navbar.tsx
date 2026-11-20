import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import type { AuthUser } from '../types';

export type AppView = 'marketplace' | 'provider-detail' | 'bookings' | 'provider-portal' | 'admin' | 'auth';

interface NavbarProps {
  currentView: AppView;
  user: AuthUser | null;
  onNavigate: (view: AppView) => void;
  onSignOut: () => void;
}

export function Navbar({ currentView, user, onNavigate, onSignOut }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks: Array<{ id: AppView; label: string }> = [
    { id: 'marketplace', label: 'Browse Pros' },
    { id: 'bookings', label: 'My Bookings' },
    { id: 'provider-portal', label: 'Provider Portal' },
    { id: 'admin', label: 'Admin' },
  ];

  const handleNav = (view: AppView) => {
    setMobileOpen(false);
    onNavigate(view);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav('marketplace')}
          className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded"
        >
          ServiceMate
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600" aria-label="Primary">
          {navLinks.map((item) => {
            const isActive =
              currentView === item.id || (item.id === 'marketplace' && currentView === 'provider-detail');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                  isActive
                    ? 'border-teal-700 text-slate-900 font-semibold'
                    : 'border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="hidden md:flex items-center shrink-0">
          {user ? (
            <button
              type="button"
              onClick={onSignOut}
              title={`Signed in as ${user.name} (${user.role})`}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              Sign Out ({user.name.split(' ')[0]})
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleNav('auth')}
              className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
            >
              Sign In
            </button>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2">
          {navLinks.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`block w-full text-left rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-teal-50 text-teal-900 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <div className="pt-2 border-t border-slate-100">
            {user ? (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onSignOut();
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                Sign Out ({user.name})
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleNav('auth')}
                className="w-full rounded-lg bg-teal-700 px-3 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
              >
                Sign In / Register
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
