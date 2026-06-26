/**
 * renderWithProviders — wraps a component with Redux store + QueryClient + MemoryRouter.
 * Use instead of `render()` for any component that touches the store or router.
 */
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/store/slices/authSlice';
import orgReducer from '@/store/slices/orgSlice';
import type { RootState } from '@/store';

interface Options {
  preloadedState?: Partial<RootState>;
  initialRoute?: string;
}

export function renderWithProviders(ui: ReactElement, { preloadedState = {}, initialRoute = '/' }: Options = {}) {
  const store = configureStore({
    reducer: { auth: authReducer, org: orgReducer },
    preloadedState,
  });

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[initialRoute]}>
            {children}
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>
    );
  }

  const result = render(ui, { wrapper: Wrapper });

  return { ...result, store, queryClient };
}
