import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './lib/auth.jsx';
import { IdentityProvider } from './lib/identity.jsx';
import { registerServiceWorker } from './lib/pwa';
import './index.css';

registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <IdentityProvider>
        <App />
      </IdentityProvider>
    </AuthProvider>
  </React.StrictMode>
);
