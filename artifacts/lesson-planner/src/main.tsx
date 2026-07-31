import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';

import './index.css';

// GitHub Pages is static. Set VITE_API_BASE_URL at build time when the API is
// hosted separately (for example, on Render, Railway, or Fly.io).
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
if (apiBaseUrl) setBaseUrl(apiBaseUrl);

createRoot(document.getElementById('root')!).render(<App />);
