import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// import './index.css' // Removed this line

// --- MUI Imports ---
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// --- Define Themes ---

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      // PayFit-like Blue
      main: '#2E2EFF', // Adjust this blue based on sampling PayFit's main button color
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#6c757d',
    },
    background: {
      // Lighter, cleaner background
      default: '#f9fafb', // Very light off-white/gray
      paper: '#ffffff',   // Pure white for cards
    },
    text: {
      // Darker primary text, lighter secondary
      primary: '#1f2937', // Dark Gray
      secondary: '#6b7280', // Medium Gray
    },
    divider: '#e5e7eb', // Lighter divider
     error: { main: '#dc3545' },
    warning: { main: '#ffc107' },
    info: { main: '#0dcaf0' },
    success: { main: '#198754' },
  },
  typography: {
    fontFamily: [ // Use system fonts for clean look, similar to many modern sites
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
        '"Apple Color Emoji"',
        '"Segoe UI Emoji"',
        '"Segoe UI Symbol"',
      ].join(','),
    h5: {
        fontWeight: 600, // Slightly bolder titles
        fontSize: '1.3rem',
        color: '#111827' // Even darker for main titles
    },
    h6: {
        fontWeight: 600,
        fontSize: '1.1rem',
         color: '#111827'
    },
    subtitle1: { // Used in AdminPanel, news titles
        fontWeight: 500,
         color: '#1f2937',
    },
     body2: { // Default body text
         color: '#374151', // Slightly lighter than primary text
     },
     caption: { // Used for secondary info like dates/sources
         color: '#6b7280',
     },
    button: {
        textTransform: 'none', // Standard case buttons
        fontWeight: 500,
    }
  },
  shape: {
    // PayFit uses slightly less rounded corners
    borderRadius: 6,
  },
  components: {
    // --- Component Defaults for PayFit Look ---
    MuiCard: {
      defaultProps: {
        elevation: 0, // Flatter look, remove shadow
        variant: "outlined", // Use outlined variant
      },
       styleOverrides: {
        root: ({ theme }) => ({
           borderColor: theme.palette.divider, // Use the theme's divider color
           backgroundColor: theme.palette.background.paper, // Ensure white background
        }),
      },
    },
    MuiCardContent: {
        styleOverrides: {
            root: {
                padding: '24px', // Increase padding inside cards
                 '&:last-child': { // Remove extra padding at the bottom
                    paddingBottom: '24px',
                },
            }
        }
    },
     MuiButton: {
         defaultProps: {
             disableElevation: true, // Flatter buttons
         },
        styleOverrides: {
            // Contained buttons (like PayFit's main actions)
            containedPrimary: ({ theme }) => ({
                 padding: '8px 22px', // Adjust padding
                 // boxShadow: 'none', // Already disabled elevation
            }),
             // Outlined buttons
            outlinedPrimary: ({ theme }) => ({
                 padding: '8px 22px',
                 // border: `1px solid ${theme.palette.primary.main}`, // Default works, ensure it's correct
            }),
             // Text buttons (for less prominent actions like Summarize/Sentiment)
             text: ({ theme }) => ({
                 padding: '6px 8px', // Smaller padding for text buttons
                 color: theme.palette.text.secondary, // Make them less prominent initially
                 '&:hover': {
                     backgroundColor: 'rgba(0, 0, 0, 0.04)', // Subtle hover
                     color: theme.palette.text.primary,
                 }
             })
        },
     },
      MuiAppBar: { // Make AppBar blend in
          defaultProps: {
              elevation: 0,
              color: 'transparent', // Use transparent background
          },
          styleOverrides: {
              root: ({ theme }) => ({
                  backgroundColor: theme.palette.background.default, // Match body background
                  color: theme.palette.text.primary,
                   borderBottom: `1px solid ${theme.palette.divider}`, // Keep a subtle bottom border
              }),
          },
      },
       MuiTextField: {
           defaultProps: {
               variant: 'outlined', // Default to outlined fields
               size: 'small',
           },
           styleOverrides: {
               root: {
                    // '& .MuiOutlinedInput-root': {
                    //     borderRadius: 6, // Match global border radius
                    // },
               }
           }
       },
        MuiAlert: { // Style alerts like PayFit's info boxes
            styleOverrides: {
                root: ({ theme, ownerState }) => ({
                     borderRadius: theme.shape.borderRadius,
                     border: `1px solid ${theme.palette[ownerState.severity]?.main || theme.palette.divider}`,
                     backgroundColor: `${theme.palette[ownerState.severity]?.main}1A`, // Transparent background based on severity
                     color: theme.palette.text.primary, // Use standard text color
                     '& .MuiAlert-icon': { // Color the icon based on severity
                         color: theme.palette[ownerState.severity]?.main,
                     },
                }),
                standardWarning: ({ theme }) => ({ // Specific overrides if needed
                    border: `1px solid ${theme.palette.warning.main}`,
                     backgroundColor: `${theme.palette.warning.main}1A`,
                }),
                 standardError: ({ theme }) => ({
                    border: `1px solid ${theme.palette.error.main}`,
                     backgroundColor: `${theme.palette.error.main}1A`,
                }),
            }
        }
  },
});

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#0d6efd', // Keep primary color consistent or adjust
    },
    secondary: {
      main: '#adb5bd',
    },
    background: {
      default: '#121212', // Dark background
      paper: '#1e1e1e',   // Slightly lighter dark for cards
    },
    text: {
      primary: '#f8f9fa',
      secondary: '#adb5bd',
    },
     error: {
      main: '#f57373', // Lighter red for dark mode
    },
    warning: {
      main: '#ffe082', // Lighter yellow
    },
    info: {
      main: '#64d8ef',
    },
    success: {
      main: '#7edc9c',
    },
    divider: 'rgba(255, 255, 255, 0.12)', // Standard divider for dark
  },
   typography: {
    fontFamily: 'inherit',
     h5: {
        fontWeight: 500,
    },
    h6: {
        fontWeight: 500,
    },
      button: {
        textTransform: 'none',
    }
  },
  shape: {
    borderRadius: 8,
  },
   components: {
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid rgba(255, 255, 255, 0.12)',
           boxShadow: 'none',
        },
      },
    },
     MuiButton: {
        styleOverrides: {
            root: {
                 boxShadow: 'none',
            },
        },
     },
      MuiAppBar: {
          styleOverrides: {
              root: ({ theme }) => ({
                  backgroundColor: theme.palette.background.paper,
                  color: theme.palette.text.primary,
                   borderBottom: `1px solid ${theme.palette.divider}`,
              }),
          },
      },
  },
});

// Store themes for access in App component
export const themes = {
    light: lightTheme,
    dark: darkTheme,
};

// AppWrapper to handle theme selection based on App's state
function AppWrapper() {
    // Get theme mode from localStorage or default to 'light'
    const [themeMode, setThemeMode] = React.useState(() => localStorage.getItem('theme') || 'light');

    // Function to pass down to App to toggle theme
    const toggleTheme = () => {
        setThemeMode((prevMode) => {
            const newMode = prevMode === 'light' ? 'dark' : 'light';
            localStorage.setItem('theme', newMode); // Save preference
            return newMode;
        });
    };

    // Select the theme object based on the current mode
    const activeTheme = themeMode === 'light' ? lightTheme : darkTheme;

    return (
        <ThemeProvider theme={activeTheme}>
            <CssBaseline />
            {/* Pass themeMode and toggleTheme down to App */}
            <App currentThemeMode={themeMode} toggleThemeCallback={toggleTheme} />
        </ThemeProvider>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppWrapper /> {/* Render the wrapper */}
  </React.StrictMode>,
)
