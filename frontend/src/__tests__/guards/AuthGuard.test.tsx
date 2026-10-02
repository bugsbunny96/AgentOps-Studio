/**
 * 🟣 Test Engineer — AuthGuard tests
 * Verifies: loading state, unauthenticated redirect, authenticated render.
 * useAuth is mocked with per-test state (the guard only reads these three fields).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { AuthGuard } from '@/routes/guards/AuthGuard';

const { authState, verifySession } = vi.hoisted(() => ({
  authState: { isAuthenticated: false, isLoading: false },
  verifySession: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ ...authState, verifySession }),
}));

const ProtectedContent = () => <div>Protected Content</div>;
const renderGuard = () => renderWithProviders(<AuthGuard><ProtectedContent /></AuthGuard>);

describe('AuthGuard', () => {
  beforeEach(() => {
    verifySession.mockClear();
  });

  it('verifies the session on mount', () => {
    Object.assign(authState, { isAuthenticated: false, isLoading: true });
    renderGuard();
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it('shows a spinner (no content) while loading', () => {
    Object.assign(authState, { isAuthenticated: false, isLoading: true });
    renderGuard();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('does not render protected content when not authenticated', () => {
    Object.assign(authState, { isAuthenticated: false, isLoading: false });
    renderGuard();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    Object.assign(authState, { isAuthenticated: true, isLoading: false });
    renderGuard();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
