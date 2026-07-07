import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
// Tipografia do design system: Space Grotesk (headings) + DM Sans (body).
// Carregamos pesos só do que usamos, evitando peso de bundle.
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import App from './App.tsx'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import { installGlobalErrorHandlers } from './lib/logger'
import { bootstrapDemoMode } from './lib/demoMode'

installGlobalErrorHandlers();
bootstrapDemoMode();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </ErrorBoundary>
);
