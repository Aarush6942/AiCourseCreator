import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';

import './index.css';


const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  'https://aicoursecreator-z7jo.onrender.com';
if (apiBaseUrl) setBaseUrl(apiBaseUrl);

createRoot(document.getElementById('root')!).render(<App />);
