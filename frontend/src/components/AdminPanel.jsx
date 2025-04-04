import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// --- MUI Imports ---
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer'; // Use Drawer for overlay panel
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid'; // For layout inside
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';

// --- Recharts Imports ---
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function AdminPanel({
    isVisible,
    onClose,
    availableModels,
    selectedSumModel,
    setSelectedSumModel,
    selectedSentModel,
    setSelectedSentModel
}) {
    const [metrics, setMetrics] = useState(null);
    const [logs, setLogs] = useState([]);
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [error, setError] = useState('');
    const intervalRef = useRef(null); // Ref to hold interval ID

    useEffect(() => {
        if (isVisible) {
            fetchMetrics();
            fetchLogs();
        }
    }, [isVisible]);

    const fetchMetrics = async () => {
        if (!metrics) setIsLoadingMetrics(true);
        try {
            const response = await axios.get(`${BACKEND_URL}/api/metrics`);
            setMetrics(response.data);
        } catch (err) {
            console.error("Error fetching metrics:", err);
            setError(prev => prev.includes('metrics') ? prev : prev + (prev ? ' ' : '') + 'Failed to fetch metrics.');
        } finally {
            if (isLoadingMetrics) setIsLoadingMetrics(false);
        }
    };

    const fetchLogs = async () => {
        setIsLoadingLogs(true);
        try {
            const response = await axios.get(`${BACKEND_URL}/api/logs`);
            setLogs(response.data.logs || []);
        } catch (err) {
            console.error("Error fetching logs:", err);
            setError(prev => prev + (prev ? ' ' : '') + 'Failed to fetch logs.');
            setLogs([]);
        } finally {
            setIsLoadingLogs(false);
        }
    };

    useEffect(() => {
        if (isVisible) {
            fetchMetrics();
            fetchLogs();

            intervalRef.current = setInterval(fetchMetrics, 10000);

            return () => {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                }
            };
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        }
    }, [isVisible]);

    const renderMetricsCharts = () => {
        if (isLoadingMetrics && !metrics) return <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}><CircularProgress /></Box>;
        if (!metrics) return <Typography variant="body2" color="text.secondary">No metrics data available.</Typography>;

        // Separate LLM Core vs Tool Usage if backend provides it
        const llmCoreData = Object.entries(metrics)
            .filter(([key]) => key !== 'tool_usage') // Exclude tool usage for this chart
            .map(([task, data]) => ({
                name: task.charAt(0).toUpperCase() + task.slice(1),
                Calls: data.calls || 0,
                Success: data.success || 0,
                Failures: data.failures || 0,
            }));

        // TODO: Prepare chartData for tool_usage if implemented in backend metrics
        const toolUsageData = metrics.tool_usage ? Object.entries(metrics.tool_usage).map(([tool, data]) => ({
            name: tool,
            Calls: data.calls || 0,
            Errors: data.errors || 0, // Assuming backend tracks errors
        })) : [];

        return (
            <Box>
                 <Typography variant="subtitle2" gutterBottom>LLM Task Metrics</Typography>
                 <Box sx={{ height: 250, width: '100%', mb: 3 }}>
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={llmCoreData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.3)" />
                            <XAxis dataKey="name" fontSize={12} />
                            <YAxis allowDecimals={false} fontSize={12} />
                            <Tooltip wrapperStyle={{ fontSize: '12px' }} />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                            <Bar dataKey="Calls" fill="#8884d8" />
                            <Bar dataKey="Success" fill="#82ca9d" />
                            <Bar dataKey="Failures" fill="#ff8080" />
                        </BarChart>
                    </ResponsiveContainer>
                </Box>

                {/* TODO: Add second chart for toolUsageData if available */}
                 {toolUsageData.length > 0 && (
                    <>
                        <Typography variant="subtitle2" gutterBottom>Tool Usage Metrics</Typography>
                        <Box sx={{ height: 200, width: '100%' }}>
                             {/* Another ResponsiveContainer + BarChart for toolUsageData */}
                        </Box>
                    </>
                 )}
            </Box>
        );
    };

     const renderModelSelectors = () => {
        return (
             <Grid container spacing={2} sx={{ mb: 2 }}>
                 <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                        <InputLabel id="summarization-model-select-label">Summarization Model</InputLabel>
                        <Select
                            labelId="summarization-model-select-label"
                            id="summarization-model-select"
                            value={selectedSumModel}
                            label="Summarization Model"
                            onChange={(e) => setSelectedSumModel(e.target.value)}
                        >
                            {availableModels.summarization.map(model => (
                                <MenuItem key={model.id} value={model.id}>
                                    {model.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
                 <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                        <InputLabel id="sentiment-model-select-label">Sentiment Model</InputLabel>
                        <Select
                            labelId="sentiment-model-select-label"
                            id="sentiment-model-select"
                            value={selectedSentModel}
                            label="Sentiment Model"
                            onChange={(e) => setSelectedSentModel(e.target.value)}
                        >
                             {availableModels.sentiment.map(model => (
                                <MenuItem key={model.id} value={model.id}>
                                    {model.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
             </Grid>
        );
     };

     const renderLogs = () => {
        if (isLoadingLogs) return <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}><CircularProgress size={24} /></Box>;
        if (!logs || logs.length === 0) return <Typography variant="body2" color="text.secondary">No logs captured.</Typography>;

        return (
            <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto', p: 1, mt: 1, bgcolor: 'rgba(0,0,0,0.05)' }}>
                <pre style={{ margin: 0, fontSize: '0.8em', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {logs.slice(-20).reverse().map((log, index) => (
                        <span key={index}>{JSON.stringify(log)}\n</span>
                    ))}
                </pre>
            </Paper>
        );
    };

    return (
        <Drawer
            anchor="right"
            open={isVisible}
            onClose={onClose}
        >
            <Box
                sx={{ width: { xs: '90vw', sm: 450 }, p: 2 }}
                role="presentation"
            >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" component="h2">Admin Panel</Typography>
                    <IconButton onClick={onClose} aria-label="Close Admin Panel">
                        <CloseIcon />
                    </IconButton>
                </Box>

                 {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                 <Button
                     onClick={() => {fetchMetrics(); fetchLogs();}}
                     disabled={isLoadingMetrics || isLoadingLogs}
                     startIcon={isLoadingMetrics || isLoadingLogs ? <CircularProgress size={16} /> : <RefreshIcon />}
                     variant="outlined"
                     size="small"
                     sx={{ mb: 2 }}
                 >
                     Refresh Data
                 </Button>

                <Divider sx={{ mb: 2 }}/>

                <Typography variant="subtitle1" gutterBottom>Model Selection</Typography>
                 {renderModelSelectors()}

                <Divider sx={{ my: 2 }}/>

                <Typography variant="subtitle1" gutterBottom>LLM Usage Metrics (Polling)</Typography>
                 {renderMetricsCharts()}

                 <Divider sx={{ my: 2 }}/>

                 <Typography variant="subtitle1" gutterBottom>Recent Logs</Typography>
                 {renderLogs()}

            </Box>
        </Drawer>
    );
}

export default AdminPanel;