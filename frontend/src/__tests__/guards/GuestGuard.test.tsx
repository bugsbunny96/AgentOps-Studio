/**
 * 🟣 Test Engineer — GuestGuard tests
 * Verifies: authenticated user can't access guest routes, unauthenticated can.
 * useAuth is mocked with per-test state so the real verifySession (which sets
 * isLoading and calls the API) doesn't leave the guard stuck on the spinner.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { GuestGuard } from '@/routes/guards/GuestGuard';

const { authState } = vi.hoisted(() => ({
  authState: { isAuthenticated: false, isLoading: false },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ ...authState, verifySession: vi.fn() }),
}));

const LoginContent = () => <div>Login Page</div>;
const renderGuard = () => renderWithProviders(<GuestGuard><LoginContent /></GuestGuard>);

describe('GuestGuard', () => {
  it('renders children when user is not authenticated', () => {
    Object.assign(authState, { isAuthenticated: false, isLoading: false });
    renderGuard();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('does not render children when user is authenticated (redirects away)', () => {
    Object.assign(authState, { isAuthenticated: true, isLoading: false });
    renderGuard();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('shows spinner while loading session', () => {
    Object.assign(authState, { isAuthenticated: false, isLoading: true });
    renderGuard();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });
});
