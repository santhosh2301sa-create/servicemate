import { useState } from 'react';
import { AdminPortalView } from './components/AdminPortalView';
import { AuthView } from './components/AuthView';
import { CustomerBookingsView } from './components/CustomerBookingsView';
import { MarketplaceView } from './components/MarketplaceView';
import { Navbar, type AppView } from './components/Navbar';
import { ProviderDetailView } from './components/ProviderDetailView';
import { ProviderPortalView } from './components/ProviderPortalView';
import { setAuthToken } from './lib/api';
import type { AuthUser } from './types';

export default function App() {
  const [view, setView] = useState<AppView>('marketplace');
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
  const [returnViewAfterAuth, setReturnViewAfterAuth] = useState<AppView>('marketplace');
  const [authDefaultRole, setAuthDefaultRole] = useState<'customer' | 'provider'>('customer');
  const [user, setUser] = useState<AuthUser | null>(null);

  const navigateTo = (nextView: AppView) => {
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openProvider = (providerId: number) => {
    setSelectedProviderId(providerId);
    navigateTo('provider-detail');
  };

  const requireAuthFrom = (originView: AppView, defaultRole: 'customer' | 'provider' = 'customer') => {
    setReturnViewAfterAuth(originView);
    setAuthDefaultRole(defaultRole);
    navigateTo('auth');
  };

  const handleAuthSuccess = (loggedInUser: AuthUser) => {
    setUser(loggedInUser);
    if (returnViewAfterAuth === 'provider-detail' && selectedProviderId) {
      navigateTo('provider-detail');
    } else if (loggedInUser.role === 'provider' && returnViewAfterAuth === 'marketplace') {
      navigateTo('provider-portal');
    } else if (loggedInUser.role === 'admin') {
      navigateTo('admin');
    } else {
      navigateTo(returnViewAfterAuth);
    }
  };

  const handleSignOut = () => {
    setAuthToken(null);
    setUser(null);
    if (view === 'admin' || view === 'provider-portal') {
      navigateTo('marketplace');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar
        currentView={view}
        user={user}
        onNavigate={(next) => {
          if (next === 'auth') {
            setReturnViewAfterAuth('marketplace');
            setAuthDefaultRole('customer');
          }
          navigateTo(next);
        }}
        onSignOut={handleSignOut}
      />

      <main className="flex-1">
        {view === 'marketplace' && <MarketplaceView onSelectProvider={openProvider} />}

        {view === 'provider-detail' && selectedProviderId !== null && (
          <ProviderDetailView
            providerId={selectedProviderId}
            user={user}
            onBack={() => navigateTo('marketplace')}
            onRequireAuth={() => requireAuthFrom('provider-detail', 'customer')}
            onBookingCreated={() => navigateTo('bookings')}
          />
        )}

        {view === 'bookings' && (
          <CustomerBookingsView
            user={user}
            onRequireAuth={() => requireAuthFrom('bookings', 'customer')}
            onBrowsePros={() => navigateTo('marketplace')}
            onSelectProvider={openProvider}
          />
        )}

        {view === 'provider-portal' && (
          <ProviderPortalView
            user={user}
            onRequireProviderAuth={() => requireAuthFrom('provider-portal', 'provider')}
          />
        )}

        {view === 'admin' && (
          <AdminPortalView
            user={user}
            onAuthSuccess={(adminUser) => setUser(adminUser)}
            onSignOut={handleSignOut}
          />
        )}

        {view === 'auth' && (
          <AuthView
            defaultRole={authDefaultRole}
            onSuccess={handleAuthSuccess}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500">
          <div>
            <span className="font-display font-semibold text-slate-800">ServiceMate</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>Local service booking demo with fictional providers and simulated schedules.</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => navigateTo('marketplace')}
              className="hover:text-slate-900"
            >
              Browse Pros
            </button>
            <button
              type="button"
              onClick={() => navigateTo('bookings')}
              className="hover:text-slate-900"
            >
              My Bookings
            </button>
            <button
              type="button"
              onClick={() => navigateTo('provider-portal')}
              className="hover:text-slate-900"
            >
              Provider Portal
            </button>
            <button
              type="button"
              onClick={() => navigateTo('admin')}
              className="hover:text-slate-900"
            >
              Admin
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
