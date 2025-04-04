import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// import './index.css' // Removed this line

// --- MUI Imports ---
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// --- Define Dark Theme ---
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      // A slightly brighter blue for dark mode contrast
      main: '#58a6ff', // Example: GitHub dark mode blue
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#8b949e', // Lighter gray for secondary elements
      contrastText: '#ffffff',
    },
    background: {
      default: '#0d1117', // Very dark background (like GitHub dark)
      paper: '#161b22',   // Slightly lighter for cards/paper
    },
    text: {
      primary: '#c9d1d9', // Light gray for primary text
      secondary: '#8b949e', // Medium gray for secondary text
      disabled: '#484f58',
    },
    divider: '#30363d', // Darker divider
    action: {
        active: '#8b949e',
        hover: 'rgba(88, 166, 255, 0.1)', // Faint blue hover
        selected: 'rgba(88, 166, 255, 0.15)',
        // ... disabled colors ...
    },
    // Define specific greys if needed
    grey: {
        800: '#161b22', // Match paper background
        700: '#30363d', // Match divider
        // ...
    },
     error: { main: '#f85149' }, // Brighter red
    warning: { main: '#d29922' }, // Brighter orange/yellow
    info: { main: '#58a6ff' }, // Match primary
    success: { main: '#56d364' }, // Brighter green
  },
  typography: {
    fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif', // Clean sans-serif
     h5: { fontWeight: 600, fontSize: '1.15rem', color: '#c9d1d9', marginBottom: '0.8em' },
    h6: { fontWeight: 600, fontSize: '1rem', color: '#c9d1d9', marginBottom: '0.5em' },
    body1: { color: '#c9d1d9', fontSize: '0.95rem', lineHeight: 1.6 },
    body2: { color: '#8b949e', fontSize: '0.9rem' },
    caption: { color: '#8b949e', fontSize: '0.8rem' },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  shape: { borderRadius: 6 },
  components: {
     MuiCssBaseline: { styleOverrides: { body: { backgroundColor: '#0d1117' } } },
     MuiPaper: {
        defaultProps: { elevation: 0, variant: 'outlined' },
        styleOverrides: { root: ({ theme }) => ({ borderColor: theme.palette.divider, backgroundColor: theme.palette.background.paper }) },
     },
      MuiAppBar: {
          defaultProps: { elevation: 0, position: 'static', color: 'default' }, // Keep static for simpler layout
          styleOverrides: { root: ({ theme }) => ({ backgroundColor: theme.palette.background.paper, borderBottom: `1px solid ${theme.palette.divider}` }) },
      },
       MuiToolbar: { styleOverrides: { dense: { minHeight: 56, paddingLeft: '16px', paddingRight: '16px' } } }, // Consistent padding
       MuiButton: { /* Keep refined button styles, ensure contrast */ },
       MuiTextField: { defaultProps: { variant: 'outlined', size: 'small' } },
       // Ensure Table components use dark theme colors
       MuiTableHead: { styleOverrides: { root: ({ theme }) => ({ /* Styles using dark theme vars */ }) } },
       MuiTableCell: { styleOverrides: { root: ({ theme }) => ({ borderColor: theme.palette.divider }) } },
       MuiAlert: { /* Ensure alert styles work well on dark background */ },
        // ... other overrides ...
  },
});

// Simpler Wrapper using only dark theme
function AppWrapper() {
    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline enableColorScheme />
            <App /> {/* Pass no theme props */}
        </ThemeProvider>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>,
)
