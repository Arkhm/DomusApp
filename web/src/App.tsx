import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import AppRoutes from './routes/AppRoutes';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--color-ink-1)',
              color: 'var(--color-bone)',
              border: '1px solid var(--color-line-strong)',
              borderRadius: '2px',
              fontSize: '13px',
              fontFamily: 'var(--font-sans)',
              padding: '12px 16px',
            },
            success: {
              iconTheme: {
                primary: 'var(--color-metal-1)',
                secondary: 'var(--color-ink-1)',
              },
            },
            error: {
              iconTheme: {
                primary: 'var(--color-err)',
                secondary: 'var(--color-ink-1)',
              },
            },
          }}
        />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
