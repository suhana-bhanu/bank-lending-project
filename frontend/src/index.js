import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Keep or remove if not using custom CSS

// Material-UI setup (if you use it)
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* Provides a clean slate for CSS */}
      <App />
    </ThemeProvider>
  </React.StrictMode>
);