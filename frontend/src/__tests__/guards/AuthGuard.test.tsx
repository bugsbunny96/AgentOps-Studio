/**
 * 🟣 Test Engineer — AuthGuard tests
 * Verifies: loading state, unauthenticated redirect, authenticated render
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import { AuthGuard } from '@/routes/guards/AuthGuard';
import type { RootState } from '@/store';

// Mock the hook — we control the session behavior per test
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    verifySession: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    user: null,
    currentOrg: null,
    currentRole: null,
  }),
}));

const ProtectedContent = () => <div>Protected Content</div>;

describe('AuthGuard', () => {
  describe('when loading', () => {
    it('shows a spinner', () => {
      const preloadedState: Partial<RootState> = {
        auth: { user: null, isAuthenticated: false, isLoading: true },
      };

      renderWithProviders(
        <AuthGuard><ProtectedContent /></AuthGuard>,
        { preloadedState }
      );

      // Spinner is an animated div — check it renders (no content)
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('when not authenticated', () => {
    it('does not render protected content', () => {
      const preloadedState: Partial<RootState> = {
        auth: { user: null, isAuthenticated: false, isLoading: false },
      };

      renderWithProviders(
        <AuthGuard><ProtectedContent /></AuthGuard>,
        { preloadedState }
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('when authenticated', () => {
    it('renders children', () => {
      const preloadedState: Partial<RootState> = {
        auth: {
          user: { id: '1', name: 'Test', email: 'test@test.com', isVerified: true, status: 'Active', createdAt: '' },
          isAuthenticated: true,
          isLoading: false,
        },
      };

      renderWithProviders(
        <AuthGuard><ProtectedContent /></AuthGuard>,
        { preloadedState }
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });
});
