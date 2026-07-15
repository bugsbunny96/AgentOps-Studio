/**
 * 🟣 Test Engineer — authSlice unit tests
 */
import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import authReducer, {
  setCredentials,
  clearCredentials,
  setAuthLoading,
} from '@/store/slices/authSlice';
import type { User } from '@/types';

const mockUser: User = {
  id: 'user-1',
  name: 'Rishabh',
  email: 'rishabh@example.com',
  isVerified: true,
  status: 'Active',
  createdAt: new Date().toISOString(),
};

function makeStore() {
  return configureStore({ reducer: { auth: authReducer } });
}

describe('authSlice', () => {
  it('has correct initial state', () => {
    const store = makeStore();
    const { auth } = store.getState();

    expect(auth.user).toBeNull();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.isLoading).toBe(true); // true on mount for session check
  });

  it('setCredentials authenticates the user', () => {
    const store = makeStore();
    store.dispatch(setCredentials(mockUser));
    const { auth } = store.getState();

    expect(auth.user).toEqual(mockUser);
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.isLoading).toBe(false);
  });

  it('clearCredentials resets state', () => {
    const store = makeStore();
    store.dispatch(setCredentials(mockUser));
    store.dispatch(clearCredentials());
    const { auth } = store.getState();

    expect(auth.user).toBeNull();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.isLoading).toBe(false);
  });

  it('setAuthLoading updates loading flag', () => {
    const store = makeStore();
    store.dispatch(setAuthLoading(false));

    expect(store.getState().auth.isLoading).toBe(false);

    store.dispatch(setAuthLoading(true));
    expect(store.getState().auth.isLoading).toBe(true);
  });

  it('clearCredentials after setCredentials leaves isAuthenticated false', () => {
    const store = makeStore();
    store.dispatch(setCredentials(mockUser));
    store.dispatch(clearCredentials());

    expect(store.getState().auth.isAuthenticated).toBe(false);
  });
});
