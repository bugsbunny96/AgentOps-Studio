/**
 * 🟣 Test Engineer — GuestGuard tests
 * Verifies: authenticated user can't access guest routes, unauthenticated can
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { GuestGuard } from '@/routes/guards/GuestGuard';
import type { RootState } from '@/store';

const LoginContent = () => <div>Login Page</div>;

describe('GuestGuard', () => {
  it('renders children when user is not authenticated', () => {
    const preloadedState: Partial<RootState> = {
      auth: { user: null, isAuthenticated: false, isLoading: false },
    };

    renderWithProviders(
      <GuestGuard><LoginContent /></GuestGuard>,
      { preloadedState }
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('does not render children when user is authenticated (redirects away)', () => {
    const preloadedState: Partial<RootState> = {
      auth: {
        user: { id: '1', name: 'Test', email: 't@t.com', isVerified: true, status: 'Active', createdAt: '' },
        isAuthenticated: true,
        isLoading: false,
      },
    };

    renderWithProviders(
      <GuestGuard><LoginContent /></GuestGuard>,
      { preloadedState }
    );

    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('shows spinner while loading session', () => {
    const preloadedState: Partial<RootState> = {
      auth: { user: null, isAuthenticated: false, isLoading: true },
    };

    renderWithProviders(
      <GuestGuard><LoginContent /></GuestGuard>,
      { preloadedState }
    );

    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });
});
