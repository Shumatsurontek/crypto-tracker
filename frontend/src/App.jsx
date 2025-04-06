import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { FaSun, FaMoon, FaSyncAlt, FaCog, FaRegCommentDots, FaRegNewspaper } from "react-icons/fa";
import PortfolioPieChart from './components/PortfolioPieChart';
import FearGreedIndexDisplay from './components/FearGreedIndexDisplay';
import NewsSummaryDisplay from './components/NewsSummaryDisplay';
import SP500Display from './components/SP500Display';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import AdminPanel from './components/AdminPanel';
import ChatbotInterface from './components/ChatbotInterface';
import './App.css'

// Use the backend URL defined in environment variable or default
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// MUI Imports
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';

// MUI Icon Imports
import SettingsIcon from '@mui/icons-material/Settings';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArticleIcon from '@mui/icons-material/Article';
import CommentIcon from '@mui/icons-material/Comment';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import ChatIcon from '@mui/icons-material/Chat';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

// Accept props from AppWrapper
function App({ currentThemeMode, toggleThemeCallback }) {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [lastFetchedAddress, setLastFetchedAddress] = useState('');
  const [portfolioData, setPortfolioData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fearGreedData, setFearGreedData] = useState(null);
  const [cryptoNewsData, setCryptoNewsData] = useState(null);
  const [worldNewsData, setWorldNewsData] = useState(null);
  const [sp500Data, setSp500Data] = useState(null);
  const [initialDataLoading, setInitialDataLoading] = useState(true);
  const [initialDataError, setInitialDataError] = useState(null);
  const [llmResults, setLlmResults] = useState({});
  const [llmLoading, setLlmLoading] = useState({});
  const [llmError, setLlmError] = useState({});
  const [availableModels, setAvailableModels] = useState({ summarization: [], sentiment: [] });
  const [selectedSumModel, setSelectedSumModel] = useState('');
  const [selectedSentModel, setSelectedSentModel] = useState('');
  const [chatResponse, setChatResponse] = useState({ loading: false, error: null, answer: null });

  const toggleAdminPanel = () => {
    setIsAdminPanelOpen(prev => !prev);
  };

  const handleAddressChange = (event) => {
    setAddress(event.target.value);
  };

  const fetchPortfolio = async (addressToFetch = address) => {
    if (!addressToFetch) {
      setError('Enter an address first to fetch or refresh.');
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(addressToFetch)) {
         setError('Invalid Ethereum address format.');
         return;
    }
    setIsLoading(true);
    setError(null);
    if (addressToFetch !== lastFetchedAddress) {
        setPortfolioData(null);
    }

    try {
      console.log(`Fetching portfolio from: ${BACKEND_URL}/api/portfolio/${addressToFetch}`);
      const response = await axios.get(`${BACKEND_URL}/api/portfolio/${addressToFetch}`);
      setPortfolioData(response.data);
      setLastFetchedAddress(addressToFetch);
    } catch (err) {
      console.error("Portfolio API Error:", err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch portfolio data.';
      setError(`Error fetching portfolio: ${errorMessage}`);
      setPortfolioData(null);
      setLastFetchedAddress('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchClick = () => {
    fetchPortfolio(address);
  };

  const handleRefreshClick = () => {
      if (lastFetchedAddress) {
          fetchPortfolio(lastFetchedAddress);
      } else {
           setError('No portfolio loaded to refresh. Enter an address and fetch first.');
      }
  }

  const handleKeyDown = (event) => {
      if (event.key === 'Enter') {
          fetchPortfolio(address);
      }
  };

  // Helper to format currency
  const formatCurrency = (value) => {
    if (typeof value !== 'number' || isNaN(value)) {
        return <Skeleton width={80} />;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  // Helper to format numbers with sufficient precision
  const formatNumber = (value, maxDecimals = 6) => {
      const num = parseFloat(value);
      if (isNaN(num)) return '-';
      // Avoid scientific notation for small numbers, show more decimals if needed
      if (num > 0 && num < 1e-6) {
          return num.toPrecision(3);
      }
      return num.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });
  }

  // === Function to call Summarization API ===
  const handleSummarize = async (article) => {
    const identifier = article.url || article.title;
    if (!article.title || !identifier) return;

    const textToSummarize = `${article.title}. ${article.description || article.content || ''}`;
    if (textToSummarize.length < 50) {
        setLlmError(prev => ({ ...prev, [identifier]: 'Text too short to summarize.' }));
        return;
    }

    setLlmLoading(prev => ({ ...prev, [identifier]: 'summarize' }));
    setLlmError(prev => ({ ...prev, [identifier]: null }));

    try {
        console.log(`Requesting summary for: ${identifier} using model: ${selectedSumModel}`);
        const response = await axios.post(`${BACKEND_URL}/api/news/summarize`, {
            text: textToSummarize,
            model_id: selectedSumModel
        });
        setLlmResults(prev => ({
            ...prev,
            [identifier]: { ...prev[identifier], summary: response.data.summary }
        }));
    } catch (err) {
        console.error("Summarization Error:", err);
        const errorMsg = err.response?.data?.error || 'Summarization failed.';
        setLlmError(prev => ({ ...prev, [identifier]: errorMsg }));
        setLlmResults(prev => ({ ...prev, [identifier]: { ...prev[identifier], summary: null } }));
    } finally {
        setLlmLoading(prev => ({ ...prev, [identifier]: null }));
    }
  };

  // === Function to call Sentiment Analysis API ===
    const handleAnalyzeSentiment = async (article) => {
        const identifier = article.url || article.title;
        if (!article.title || !identifier) return;

        const textToAnalyze = `${article.title}. ${article.description || article.content || ''}`;
         if (textToAnalyze.length < 10) {
            setLlmError(prev => ({ ...prev, [identifier]: 'Text too short for sentiment analysis.' }));
            return;
        }

        setLlmLoading(prev => ({ ...prev, [identifier]: 'sentiment' }));
        setLlmError(prev => ({ ...prev, [identifier]: null }));

        try {
            console.log(`Requesting sentiment for: ${identifier} using model: ${selectedSentModel}`);
            const response = await axios.post(`${BACKEND_URL}/api/news/sentiment/analyze`, {
                text: textToAnalyze,
                model_id: selectedSentModel
            });
             setLlmResults(prev => ({
                ...prev,
                [identifier]: { ...prev[identifier], sentiment: response.data.sentiment }
            }));
        } catch (err) {
            console.error("Sentiment Analysis Error:", err);
            const errorMsg = err.response?.data?.error || 'Sentiment analysis failed.';
            setLlmError(prev => ({ ...prev, [identifier]: errorMsg }));
            setLlmResults(prev => ({ ...prev, [identifier]: { ...prev[identifier], sentiment: null } }));
        } finally {
            setLlmLoading(prev => ({ ...prev, [identifier]: null }));
        }
    };

  // === Function to call Chat API ===
  const handleChatQuery = async (question) => {
    setChatResponse({ loading: true, error: null, answer: null });
    try {
      console.log(`Sending question to chat API: ${question}`);
      // Update API endpoint from /api/agent/invoke to /api/chat/ask
      const response = await axios.post(`${BACKEND_URL}/api/chat/ask`, {
        question: question
      });
      console.log("Chat response:", response.data);
      setChatResponse({
        loading: false,
        answer: response.data.answer,
        executionTime: response.data.execution_time || "N/A"
      });
    } catch (err) {
      console.error("Chat API Error:", err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to get response from AI.';
      setChatResponse({
        loading: false,
        error: errorMessage
      });
    }
  };

  // Effect to fetch ALL initial dashboard data
  useEffect(() => {
    const fetchInitialData = async () => {
        setInitialDataLoading(true);
        setInitialDataError(null);
        let errors = [];

        try {
            console.log("Fetching initial dashboard data...");
            const results = await Promise.allSettled([
                axios.get(`${BACKEND_URL}/api/market/fear-greed`),
                axios.get(`${BACKEND_URL}/api/market/index`),
                axios.get(`${BACKEND_URL}/api/news/crypto`),
                axios.get(`${BACKEND_URL}/api/news/world`)
            ]);

             // Process Fear & Greed
            const fearGreedResult = results[0];
            if (fearGreedResult.status === 'fulfilled') {
                 setFearGreedData(fearGreedResult.value.data);
            } else {
                console.error("Fear & Greed Error:", fearGreedResult.reason);
                errors.push('Fear & Greed');
            }

            // Process Market Index Data
            const marketIndexResult = results[1];
            if (marketIndexResult.status === 'fulfilled') {
                setSp500Data(marketIndexResult.value.data);
            } else {
                 const errorDetail = marketIndexResult.reason?.response?.data?.error || marketIndexResult.reason?.message || 'Unknown';
                 
                const statusCode = marketIndexResult.reason?.response?.status;
                if (statusCode === 403) {
                    console.warn(`Market Index Warning: ${errorDetail}`);
                    setSp500Data({ error: errorDetail });
                } else {
                    console.error(`Market Index Error: ${errorDetail}`);
                    errors.push(`Market Index`);
                }
            }
            
            // Process Crypto News Summary
            const cryptoNewsResult = results[2];
            if (cryptoNewsResult.status === 'fulfilled' && cryptoNewsResult.value.data.articles) {
                 setCryptoNewsData(cryptoNewsResult.value.data.articles);
            } else {
                const errorDetail = cryptoNewsResult.reason?.response?.data?.error || cryptoNewsResult.reason?.message || 'Unknown';
                console.error(`Crypto News Error: ${errorDetail}`);
                errors.push(`Crypto News`);
            }

            // Process World News Summary
            const worldNewsResult = results[3];
            if (worldNewsResult.status === 'fulfilled' && worldNewsResult.value.data.articles) {
                setWorldNewsData(worldNewsResult.value.data.articles);
            } else {
                 const errorDetail = worldNewsResult.reason?.response?.data?.error || worldNewsResult.reason?.message || 'Unknown';
                console.error(`World News Error: ${errorDetail}`);
                errors.push(`World News`);
            }


            if (errors.length > 0) {
                const finalErrors = errors.filter(e => e !== 'Market Index' || !sp500Data?.error);
                if (finalErrors.length > 0) {
                    setInitialDataError(`Failed to load some data: ${finalErrors.join(', ')}. Check console/API keys.`);
                }
            }

        } catch (err) {
            console.error("General Initial Data Fetch Error:", err);
            setInitialDataError('Critical error loading initial dashboard data.');
        } finally {
            setInitialDataLoading(false);
        }
    };

    fetchInitialData();
  }, []); // Runs only once on mount

  // Fetch available models on mount
  useEffect(() => {
    const fetchModels = async () => {
        try {
            const response = await axios.get(`${BACKEND_URL}/api/llm/models`);
            setAvailableModels(response.data);
            // Set initial selection to the first model (or default if marked)
            if (response.data?.summarization?.length > 0) {
                setSelectedSumModel(response.data.summarization[0].id);
            }
             if (response.data?.sentiment?.length > 0) {
                setSelectedSentModel(response.data.sentiment[0].id);
            }
        } catch (error) {
            console.error("Failed to fetch available LLM models:", error);
            // Handle error display if needed
        }
    };
    fetchModels();
  }, []); // Run once on mount

  const skeletonBaseColor = currentThemeMode === 'light' ? '#ebebeb' : '#333';
  const skeletonHighlightColor = currentThemeMode === 'light' ? '#f5f5f5' : '#444';

  // Helper function to render sentiment label with color
  const renderSentimentLabel = (sentiment) => {
      if (!sentiment || !sentiment.label) return null;
      const sentimentClass = sentiment.label.toLowerCase(); // e.g., 'positive', 'negative'
      const scorePercent = (sentiment.score * 100).toFixed(1);
  return (
          <span className={`sentiment-label sentiment-${sentimentClass}`}>
              {sentiment.label} ({scorePercent}%)
          </span>
      );
  };

  // --- Navigation Items ---
  const navItems = [
      { text: 'Dashboard', icon: <DashboardIcon />, view: 'dashboard' },
      { text: 'Chat', icon: <ChatIcon />, view: 'chat' },
      { text: 'Admin', icon: <AdminPanelSettingsIcon />, view: 'admin' }, // Or trigger modal
  ];

  // --- Drawer Content ---
  const drawer = (
      <Box>
          <Toolbar variant="dense" /> {/* Spacer to match AppBar height */}
          <Divider />
          <List>
              {navItems.map((item) => (
                  <ListItem key={item.text} disablePadding>
                      <ListItemButton
                          selected={currentView === item.view}
                          onClick={() => {
                              if (item.view === 'admin') {
                                  toggleAdminPanel(); // Open modal instead of changing view
                              } else {
                                  setCurrentView(item.view);
                              }
                          }}
                      >
                          <ListItemIcon>{item.icon}</ListItemIcon>
                          <ListItemText primary={item.text} />
                      </ListItemButton>
                  </ListItem>
              ))}
          </List>
      </Box>
  );

  // --- Main Content Rendering Logic ---
  const renderContent = () => {
      // Loading/Error states handled globally above main content area
      if (initialDataLoading && !initialDataError) {
           return <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>;
      }
      if (initialDataError && currentView !== 'admin' && currentView !=='chat') { // Don't show global error on admin/chat maybe
           return <Alert severity="error">{initialDataError}</Alert>;
      }

      switch (currentView) {
          case 'dashboard':
              return (
                  <Stack spacing={3}>
                      {/* Top Section: Market Data */}
                      <Grid container spacing={3}>
                          {/* Fear & Greed */}
                          <Grid item xs={12} sm={6} md={4}>
                              <Paper sx={{ p: 2.5, height: '100%' }}>
                                  <Typography variant="h6" gutterBottom>Sentiment</Typography>
                                  {fearGreedData ? <FearGreedIndexDisplay data={fearGreedData} /> : <Skeleton variant="rectangular" height={150} />}
                              </Paper>
                          </Grid>
                           {/* Market Index */}
                           <Grid item xs={12} sm={6} md={4}>
                              <Paper sx={{ p: 2.5, height: '100%' }}>
                                  <Typography variant="h6" gutterBottom>Market Index</Typography>
                                  {sp500Data ? (sp500Data.error ? <Alert severity="warning">{sp500Data.error}</Alert> : <SP500Display data={sp500Data} />) : <Skeleton variant="rectangular" height={150} />}
                              </Paper>
                          </Grid>
                           {/* Quick Actions */}
                           <Grid item xs={12} md={4}>
                               <Paper sx={{ p: 2.5, height: '100%' }}>
                                   <Typography variant="h6" gutterBottom>Quick Actions</Typography>
                                   <Stack spacing={1}>
                                       <Button 
                                           variant="outlined" 
                                           onClick={toggleAdminPanel}
                                           startIcon={<SettingsIcon />}
                                       >
                                           Configure API Settings
                                       </Button>
                                       <Button 
                                           variant="outlined" 
                                           onClick={() => setCurrentView('chat')}
                                           startIcon={<ChatIcon />}
                                       >
                                           Ask Crypto Agent
                                       </Button>
                                   </Stack>
                               </Paper>
                           </Grid>
                      </Grid>

                      {/* Middle Section: Portfolio Tracker */}
                      <Paper component="section">
                          <CardContent>
                              <Typography variant="h5" gutterBottom>Track Wallet</Typography>
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
                                  <TextField label="Ethereum Address" value={address} onChange={handleAddressChange} onKeyDown={handleKeyDown} sx={{ flexGrow: 1 }} />
                                  <Button variant="contained" onClick={handleFetchClick} disabled={isLoading || !address}>Fetch</Button>
                                  <Button variant="outlined" onClick={handleRefreshClick} disabled={isLoading || !lastFetchedAddress} startIcon={<RefreshIcon />}>Refresh</Button>
                              </Stack>
                              {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                           </CardContent>
                      </Paper>

                      {/* Display Portfolio Data if Available */}
                      {portfolioData && lastFetchedAddress && (
                           <Paper component="section">
                               <CardContent>
                                   <PortfolioPieChart data={portfolioData.assets} />
                               </CardContent>
                           </Paper>
                       )}

                      {/* News Section: Grid with Crypto & World News */}
                      <Grid container spacing={3}>
                          <Grid item xs={12} md={6}>
                              <Paper sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
                                  <Typography variant="h6" gutterBottom>Crypto News</Typography>
                                  <NewsSummaryDisplay
                                      newsData={cryptoNewsData}
                                      sourceName="crypto"
                                      isLoading={initialDataLoading}
                                      handleSummarize={handleSummarize}
                                      handleAnalyzeSentiment={handleAnalyzeSentiment}
                                      llmLoading={llmLoading}
                                      llmResults={llmResults}
                                      llmError={llmError}
                                  />
                              </Paper>
                          </Grid>
                          <Grid item xs={12} md={6}>
                              <Paper sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
                                  <Typography variant="h6" gutterBottom>World News</Typography>
                                  <NewsSummaryDisplay
                                      newsData={worldNewsData}
                                      sourceName="world"
                                      isLoading={initialDataLoading}
                                      handleSummarize={handleSummarize}
                                      handleAnalyzeSentiment={handleAnalyzeSentiment}
                                      llmLoading={llmLoading}
                                      llmResults={llmResults}
                                      llmError={llmError}
                                  />
                              </Paper>
                          </Grid>
                      </Grid>
                  </Stack>
              );
          case 'chat':
              return (
                  <Paper sx={{ height: 'calc(100vh - 64px - 48px - 16px)', p: 0 }}> {/* Adjust height dynamically */}
                      <ChatbotInterface />
                  </Paper>
              );
          default:
              return <Typography>Select a section</Typography>;
      }
  };

  // --- Component Render ---
  return (
      <Box sx={{ display: 'flex', bgcolor: 'background.default', minHeight: '100vh' }}>
          <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
              <Toolbar variant="dense">
                  <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
                      {/* Optionally display current view title */}
                      {navItems.find(item => item.view === currentView)?.text || 'Dashboard'}
                  </Typography>
                   {/* Add other AppBar actions if needed */}
              </Toolbar>
          </AppBar>
          <Drawer
              variant="permanent" // Persistent sidebar
              sx={{
                  width: 240,
                  flexShrink: 0,
                  [`& .MuiDrawer-paper`]: { width: 240, boxSizing: 'border-box', borderRight: (theme) => `1px solid ${theme.palette.divider}` },
              }}
          >
              {drawer} {/* Render sidebar content */}
          </Drawer>
          <Box
              component="main"
              sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3, width: { sm: `calc(100% - 240px)` } }}
          >
              <Toolbar variant="dense" /> {/* Spacer for AppBar */}
               {renderContent()} {/* Render main content based on currentView */}
          </Box>

          {/* Admin Panel (Modal/Drawer) - keep previous implementation */}
          {/* Ensure AdminPanel component is refactored to use MUI */}
           <AdminPanel
              isVisible={isAdminPanelOpen}
              onClose={toggleAdminPanel}
              availableModels={availableModels}
              selectedSumModel={selectedSumModel}
              setSelectedSumModel={setSelectedSumModel}
              selectedSentModel={selectedSentModel}
              setSelectedSentModel={setSelectedSentModel}
           />
      </Box>
  );
}

export default App;
