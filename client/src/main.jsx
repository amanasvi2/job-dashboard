import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        style: { background: '#1f2937', color: '#f3f4f6', border: '1px solid #374151' },
        success: { iconTheme: { primary: '#6b8cff', secondary: '#f3f4f6' } },
      }}
    />
  </React.StrictMode>
);
