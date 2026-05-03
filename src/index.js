import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx'; // Importa il file App.jsx che hai già

// Collega React al div con id="root" che abbiamo creato nell'HTML
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
