import { useState, useEffect } from 'react'
import axios from 'axios'
import { FaSun, FaMoon, FaSyncAlt, FaCog, FaRegCommentDots, FaRegNewspaper } from "react-icons/fa";
import PortfolioPieChart from './components/PortfolioPieChart';
import FearGreedIndexDisplay from './components/FearGreedIndexDisplay';
import NewsSummaryDisplay from './components/NewsSummaryDisplay';
import SP500Display from './components/SP500Display';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import AdminPanel from './components/AdminPanel';
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

// MUI Icon Imports
import SettingsIcon from '@mui/icons-material/Settings';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArticleIcon from '@mui/icons-material/Article';
import CommentIcon from '@mui/icons-material/Comment';

// Accept props from AppWrapper
function App({ currentThemeMode, toggleThemeCallback }) {
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
  const [isAdminPanelVisible, setIsAdminPanelVisible] = useState(false);
  // === New State for LLM results ===
  const [llmResults, setLlmResults] = useState({}); // Store summaries/sentiments keyed by article identifier (e.g., url)
  const [llmLoading, setLlmLoading] = useState({}); // Track loading state per article
  const [llmError, setLlmError] = useState({});     // Track errors per article

  const toggleAdminPanel = () => {
    setIsAdminPanelVisible(prev => !prev);
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
    const identifier = article.url || article.title; // Use URL or title as a key
    if (!article.title || !identifier) return; // Need text/identifier

    const textToSummarize = `${article.title}. ${article.description || article.content || ''}`; // Combine title and description/content
    if (textToSummarize.length < 50) { // Don't summarize very short texts
        setLlmError(prev => ({ ...prev, [identifier]: 'Text too short to summarize.' }));
        return;
    }

    setLlmLoading(prev => ({ ...prev, [identifier]: 'summarize' }));
    setLlmError(prev => ({ ...prev, [identifier]: null })); // Clear previous error

    try {
        console.log(`Requesting summary for: ${identifier}`);
        const response = await axios.post(`${BACKEND_URL}/api/news/summarize`, {
            text: textToSummarize
        });
        setLlmResults(prev => ({
            ...prev,
            [identifier]: { ...prev[identifier], summary: response.data.summary }
        }));
    } catch (err) {
        console.error("Summarization Error:", err);
        const errorMsg = err.response?.data?.error || 'Summarization failed.';
        setLlmError(prev => ({ ...prev, [identifier]: errorMsg }));
        setLlmResults(prev => ({ ...prev, [identifier]: { ...prev[identifier], summary: null } })); // Clear summary on error
    } finally {
        setLlmLoading(prev => ({ ...prev, [identifier]: null }));
    }
  };

  // === Function to call Sentiment Analysis API ===
    const handleAnalyzeSentiment = async (article) => {
        const identifier = article.url || article.title;
        if (!article.title || !identifier) return;

        const textToAnalyze = `${article.title}. ${article.description || article.content || ''}`;
         if (textToAnalyze.length < 10) { // Don't analyze very short texts
            setLlmError(prev => ({ ...prev, [identifier]: 'Text too short for sentiment analysis.' }));
            return;
        }

        setLlmLoading(prev => ({ ...prev, [identifier]: 'sentiment' }));
        setLlmError(prev => ({ ...prev, [identifier]: null }));

        try {
            console.log(`Requesting sentiment for: ${identifier}`);
            const response = await axios.post(`${BACKEND_URL}/api/sentiment/analyze`, {
                text: textToAnalyze
            });
             setLlmResults(prev => ({
                ...prev,
                [identifier]: { ...prev[identifier], sentiment: response.data.top_sentiment } // Store only top result for simplicity
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
                axios.get(`${BACKEND_URL}/api/news/crypto`),
                axios.get(`${BACKEND_URL}/api/market/index`),
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

            // Process Crypto News Summary
            const cryptoNewsResult = results[1];
            if (cryptoNewsResult.status === 'fulfilled' && cryptoNewsResult.value.data.articles) {
                 setCryptoNewsData(cryptoNewsResult.value.data.articles);
            } else {
                const errorDetail = cryptoNewsResult.reason?.response?.data?.error || cryptoNewsResult.reason?.message || 'Unknown';
                console.error(`Crypto News Error: ${errorDetail}`);
                errors.push(`Crypto News`);
            }

            // Process Market Index Data (formerly S&P 500)
            const marketIndexResult = results[2];
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

  return (
    <Box sx={{ bgcolor: 'background.default', color: 'text.primary', minHeight: '100vh' }}>
        <AppBar position="static">
            <Toolbar>
                <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
                    Dashboard
                </Typography>
                <IconButton color="inherit" onClick={toggleAdminPanel}><SettingsIcon /></IconButton>
                <IconButton color="inherit" onClick={toggleThemeCallback}>
                    {currentThemeMode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
                </IconButton>
            </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ mt: 5, mb: 5 }}>
            {isAdminPanelVisible && <AdminPanel isVisible={isAdminPanelVisible} onClose={toggleAdminPanel} />}

            {initialDataLoading && !initialDataError && (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}>
                    <CircularProgress />
                </Box>
            )}
            {initialDataError && <Alert severity="error" sx={{ mb: 4 }}>{initialDataError}</Alert>}

            <Card sx={{ mb: 4 }}>
                <CardContent>
                    <Typography variant="h5" component="h2" gutterBottom>
                        Track Your Wallet
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                        <TextField
                            label="Ethereum Address"
                            variant="outlined"
                            size="small"
                            value={address}
                            onChange={handleAddressChange}
                            onKeyDown={handleKeyDown}
                            placeholder="0x..."
                            sx={{ flexGrow: 1, minWidth: '300px' }}
                        />
                        <Button
                            variant="contained"
                            onClick={handleFetchClick}
                            disabled={isLoading || !address}
                            startIcon={isLoading && lastFetchedAddress !== address ? <CircularProgress size={20} color="inherit" /> : null}
                        >
                            Fetch
                        </Button>
                         <Button
                            variant="outlined"
                            onClick={handleRefreshClick}
                            disabled={isLoading || !lastFetchedAddress}
                            startIcon={isLoading && lastFetchedAddress === address ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                        >
                            Refresh
                         </Button>
                    </Box>
                     {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                </CardContent>
            </Card>

            {portfolioData && lastFetchedAddress && (
                 <Card sx={{ mb: 4 }}>
                    <CardContent>
                        <Typography variant="h5" component="h2" gutterBottom>
                           Portfolio: <Typography component="span" sx={{ fontFamily: 'monospace', fontSize: '0.9em', color: 'text.secondary' }}>{lastFetchedAddress}</Typography>
                        </Typography>
                         <Typography variant="h6" gutterBottom>
                             Total Value: {isLoading ? <Skeleton width={100} inline /> : <strong>{formatCurrency(portfolioData.totalValueUsd)}</strong>}
                         </Typography>
                         <Grid container spacing={4} sx={{ mt: 1 }}>
                             <Grid item xs={12} md={5}>
                                <Typography variant="h6" component="h3" gutterBottom>Allocation</Typography>
                                 {portfolioData.assets && portfolioData.assets.length > 0 ? (
                                     <PortfolioPieChart data={portfolioData.assets} />
                                  ) : <Typography variant="body2" color="text.secondary">No chart data available.</Typography>}
                             </Grid>
                             <Grid item xs={12} md={7}>
                                <Typography variant="h6" component="h3" gutterBottom>Assets</Typography>
                                {portfolioData.assets && portfolioData.assets.length > 0 ? (
                                    <table className="portfolio-table">
                                        <thead><tr><th>Asset</th><th>Balance</th><th>Price (USD)</th><th>Value (USD)</th></tr></thead>
                                        <tbody>
                                            {portfolioData.assets.map(asset => (<tr key={asset.symbol}><td>{asset.symbol}</td><td>{formatNumber(asset.balance)}</td><td>{formatCurrency(asset.priceUsd)}</td><td>{formatCurrency(asset.valueUsd)}</td></tr>))}
                                            {portfolioData.ethBalanceFormatted && (<tr><td>ETH</td><td>{formatNumber(portfolioData.ethBalanceFormatted)}</td><td>{formatCurrency(portfolioData.ethPriceUsd)}</td><td>{formatCurrency(portfolioData.ethValueUsd)}</td></tr>)}
                                        </tbody>
                                    </table>
                                ) : <Typography variant="body2" color="text.secondary">No assets with value found.</Typography>}
                             </Grid>
                         </Grid>
                     </CardContent>
                 </Card>
             )}

            {!initialDataLoading && !initialDataError && (
                <Grid container spacing={4}>

                     <Grid item xs={12} md={6} lg={4}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" component="h2" gutterBottom>Market Sentiment</Typography>
                                {fearGreedData ? <FearGreedIndexDisplay data={fearGreedData} /> : <Skeleton height={120} />}
                            </CardContent>
                        </Card>
                    </Grid>

                     <Grid item xs={12} md={6} lg={4}>
                         <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" component="h2" gutterBottom>Market Index (Dow Jones)</Typography>
                                {sp500Data ? (
                                    sp500Data.error ? <Alert severity="warning" variant="outlined">{sp500Data.error}</Alert> : <SP500Display data={sp500Data} />
                                ) : <Skeleton height={120}/>}
                            </CardContent>
                        </Card>
                    </Grid>

                     <Grid item xs={12} lg={4}>
                         <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" component="h2" gutterBottom>Crypto News</Typography>
                                {cryptoNewsData ? (
                                    <Box sx={{ maxHeight: '500px', overflowY: 'auto', pr: 1 }}>
                                        {cryptoNewsData.map((article, index) => {
                                            const identifier = article.url || article.title;
                                            const isLoadingSummary = llmLoading[identifier] === 'summarize';
                                            const isLoadingSentiment = llmLoading[identifier] === 'sentiment';
                                            const summary = llmResults[identifier]?.summary;
                                            const sentiment = llmResults[identifier]?.sentiment;
                                            const error = llmError[identifier];
                                            return (
                                                <Box key={identifier || index} sx={{ mb: 3, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
                                                    <Typography variant="subtitle1" component="h4" gutterBottom sx={{ fontWeight: 500 }}>
                                                        <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>{article.title}</a>
                                                    </Typography>
                                                    <Typography variant="caption" display="block" gutterBottom>{article.source} {article.published_at ? `- ${new Date(article.published_at).toLocaleDateString()}` : ''}</Typography>
                                                    {error && <Alert severity="error" variant="outlined" size="small" sx={{ my: 1 }}>{error}</Alert>}
                                                    {summary && <Typography variant="body2" sx={{ fontStyle: 'italic', my: 1, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>{summary}</Typography>}
                                                    {sentiment && <Box sx={{ my: 1 }}>{renderSentimentLabel(sentiment)}</Box>}
                                                    <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                                                         <Button size="small" variant="text" startIcon={isLoadingSummary ? <CircularProgress size={16} /> : <ArticleIcon />} onClick={() => handleSummarize(article)} disabled={isLoadingSummary || isLoadingSentiment}>Summary</Button>
                                                         <Button size="small" variant="text" startIcon={isLoadingSentiment ? <CircularProgress size={16} /> : <CommentIcon />} onClick={() => handleAnalyzeSentiment(article)} disabled={isLoadingSummary || isLoadingSentiment}>Sentiment</Button>
                                                    </Box>
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                ) : <Skeleton count={5} height={60} />}
                            </CardContent>
                        </Card>
                    </Grid>

                </Grid>
            )}

        </Container>
    </Box>
  );
}

export default App;
