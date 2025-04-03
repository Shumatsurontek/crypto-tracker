import React, { useState, useEffect } from 'react';
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

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function AdminPanel({ isVisible, onClose }) {
    const [metrics, setMetrics] = useState(null);
    const [logs, setLogs] = useState([]);
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isVisible) {
            fetchMetrics();
            fetchLogs();
        }
    }, [isVisible]);

    const fetchMetrics = async () => {
        setIsLoadingMetrics(true);
        setError('');
        try {
            const response = await axios.get(`${BACKEND_URL}/api/metrics`);
            setMetrics(response.data);
        } catch (err) {
            console.error("Error fetching metrics:", err);
            setError('Failed to fetch metrics.');
            setMetrics(null);
        } finally {
            setIsLoadingMetrics(false);
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

    const renderMetrics = () => {
        if (isLoadingMetrics) return <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}><CircularProgress size={24} /></Box>;
        if (!metrics) return <Typography variant="body2" color="text.secondary">No metrics data available.</Typography>;

        return (
             <Grid container spacing={2}>
                {Object.entries(metrics).map(([task, data]) => (
                    <Grid item xs={12} sm={6} key={task}>
                         <Paper variant="outlined" sx={{ p: 1.5 }}>
                            <Typography variant="subtitle1" gutterBottom sx={{ textTransform: 'capitalize', fontWeight: 'medium' }}>{task}</Typography>
                            <Typography variant="body2" component="div"><strong>Model:</strong> {data.model || 'N/A'}</Typography>
                            <Typography variant="body2" component="div"><strong>Calls:</strong> {data.calls}</Typography>
                            <Typography variant="body2" component="div"><strong>Success:</strong> {data.success}</Typography>
                            <Typography variant="body2" component="div"><strong>Failures:</strong> {data.failures}</Typography>
                            <Typography variant="body2" component="div"><strong>Avg. Latency:</strong> {data.average_latency_ms} ms</Typography>
                         </Paper>
                    </Grid>
                ))}
             </Grid>
        );
    };

     const renderLogs = () => {
        if (isLoadingLogs) return <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}><CircularProgress size={24} /></Box>;
        if (!logs || logs.length === 0) return <Typography variant="body2" color="text.secondary">No logs captured.</Typography>;

        return (
            <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto', p: 1, mt: 1, bgcolor: 'rgba(0,0,0,0.05)' }}>
                <pre style={{ margin: 0, fontSize: '0.8em', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {logs.slice(-20).reverse().map((log, index) => ( // Show last 20
                        <span key={index}>{JSON.stringify(log)}\n</span> // Basic JSON display
                    ))}
                </pre>
            </Paper>
        );
    };

    return (
        // Use Drawer for a slide-in panel effect
        <Drawer
            anchor="right" // Slide in from the right
            open={isVisible}
            onClose={onClose}
        >
            <Box
                sx={{ width: 400, p: 2 }} // Set width and padding for the drawer content
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

                <Typography variant="subtitle1" gutterBottom>LLM Metrics</Typography>
                 {renderMetrics()}

                 <Divider sx={{ my: 2 }}/>

                 <Typography variant="subtitle1" gutterBottom>Recent Logs</Typography>
                 {renderLogs()}

            </Box>
        </Drawer>
    );
}

export default AdminPanel;