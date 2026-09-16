import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';

import { store } from '@/store';
import { router } from '@/routes';
import { initSentry } from '@/lib/sentry';
import { SentryErrorBoundary } from '@/components/SentryErrorBoundary';
import '@/styles/index.css';

// Initialise Sentry before the React tree is rendered.
// No-ops in development (DEV guard is inside initSentry).
initSentry();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,        // 2 min
      retry: (failureCount, error: unknown) => {
        // Don't retry on 4xx
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as { status: number }).status;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <SentryErrorBoundary>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </Provider>
    </SentryErrorBoundary>
  </StrictMode>,
);
