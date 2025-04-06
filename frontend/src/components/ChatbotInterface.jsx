import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

// MUI Imports
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import SendIcon from '@mui/icons-material/Send';
import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Grid';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function ChatbotInterface() {
    const [messages, setMessages] = useState([]); // { sender: 'user'/'agent', text: '...' }
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [loadingModels, setLoadingModels] = useState(true);
    const messagesEndRef = useRef(null); // To scroll to bottom

    // Fetch available models on component mount
    useEffect(() => {
        const fetchModels = async () => {
            try {
                const response = await axios.get(`${BACKEND_URL}/api/chat/models`);
                setModels(response.data.models || []);
                setSelectedModel(response.data.current || '');
                setLoadingModels(false);
            } catch (err) {
                console.error("Failed to fetch chat models:", err);
                setError("Failed to load available models");
                setLoadingModels(false);
            }
        };
        
        fetchModels();
    }, []);

    // Handle initial message
    useEffect(() => {
        if (models.length > 0 && messages.length === 0) {
            // Add initial message when models are loaded
            const recommendedModel = models.find(m => m.name.includes("Recommended"));
            if (recommendedModel) {
                setMessages([{
                    sender: 'system',
                    text: `Welcome! This chat agent is using ${recommendedModel.name.split('(')[0].trim()}. Some models may have limited availability from the Hugging Face API.`
                }]);
            }
        }
    }, [models, messages]);

    // Scroll to bottom effect
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleInputChange = (event) => {
        setInput(event.target.value);
    };

    const handleModelChange = async (event) => {
        const newModel = event.target.value;
        setSelectedModel(newModel);
        
        try {
            await axios.post(`${BACKEND_URL}/api/chat/models/select`, {
                model_id: newModel
            });
            // Add system message about model change
            setMessages(prev => [...prev, { 
                sender: 'system', 
                text: `Model changed to ${models.find(m => m.id === newModel)?.name || newModel}`
            }]);
        } catch (err) {
            console.error("Failed to change model:", err);
            setError(`Failed to change model: ${err.response?.data?.error || 'Unknown error'}`);
            // Revert to previous selection by refetching current model
            try {
                const response = await axios.get(`${BACKEND_URL}/api/chat/models`);
                setSelectedModel(response.data.current || '');
            } catch {
                // If refetch fails, just keep the UI selection as is
            }
        }
    };

    const handleSend = async () => {
        const userMessage = input.trim();
        if (!userMessage || isLoading) return;

        // Add user message to chat
        setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
        setInput('');
        setIsLoading(true);
        setError('');

        try {
            // Call updated chat endpoint with selected model
            const response = await axios.post(`${BACKEND_URL}/api/chat/ask`, {
                question: userMessage,
                model_id: selectedModel
            });

            // Add agent response to chat (using the new response format)
            setMessages(prev => [...prev, { 
                sender: 'agent', 
                text: response.data.answer,
                executionTime: response.data.execution_time,
                model: response.data.model
            }]);

        } catch (err) {
            console.error("Chat API error:", err);
            const errorMsg = err.response?.data?.error || 'Agent failed to respond.';
            setError(errorMsg);
            // Add an error message to the chat
            setMessages(prev => [...prev, { sender: 'agent', text: `Error: ${errorMsg}`, isError: true }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); // Prevent newline on enter
            handleSend();
        }
    };

    // Add a helper function to get model status indicator
    const getModelStatusIndicator = (modelId) => {
        // Based on observed behavior
        if (modelId.includes("llama")) {
            return "🟢"; // Working well
        } else if (modelId.includes("phi")) {
            return "🟡"; // Sometimes works
        } else {
            return "🟠"; // May have issues
        }
    };

    return (
        <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 'calc(100% - 16px)' }}> {/* Adjust height as needed */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Agent Chat</Typography>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel id="model-select-label">Model</InputLabel>
                    <Select
                        labelId="model-select-label"
                        value={selectedModel}
                        label="Model"
                        onChange={handleModelChange}
                        disabled={loadingModels}
                    >
                        {loadingModels ? (
                            <MenuItem value="">
                                <CircularProgress size={20} />
                                <Typography variant="body2" sx={{ ml: 1 }}>Loading models...</Typography>
                            </MenuItem>
                        ) : (
                            models.map((model) => (
                                <MenuItem key={model.id} value={model.id}>
                                    {getModelStatusIndicator(model.id.toLowerCase())} {model.name}
                                </MenuItem>
                            ))
                        )}
                    </Select>
                </FormControl>
            </Box>
            
            {/* Message Display Area */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', mb: 2, pr: 1 }}>
                {messages.map((msg, index) => (
                    <Box key={index} sx={{ mb: 1.5, textAlign: msg.sender === 'user' ? 'right' : 'left' }}>
                        <Paper
                            elevation={1}
                            sx={{
                                p: 1,
                                display: 'inline-block',
                                maxWidth: '80%',
                                bgcolor: msg.isError ? 'error.main' : 
                                       (msg.sender === 'user' ? 'primary.main' : 
                                       (msg.sender === 'system' ? 'info.light' : 'action.hover')),
                                color: msg.isError ? 'error.contrastText' : 
                                      (msg.sender === 'user' ? 'primary.contrastText' : 
                                      (msg.sender === 'system' ? 'info.contrastText' : 'text.primary')),
                                borderRadius: msg.sender === 'user' ? '15px 15px 0 15px' : '15px 15px 15px 0',
                            }}
                        >
                             {/* Basic text display, can enhance with Markdown later */}
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {msg.text}
                            </Typography>
                            {msg.executionTime && (
                                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.7 }}>
                                    {msg.executionTime} • {msg.model ? `${getModelStatusIndicator(msg.model.toLowerCase())} ${models.find(m => m.id === msg.model)?.name || msg.model}` : ''}
                                </Typography>
                            )}
                        </Paper>
                    </Box>
                ))}
                {/* Empty div to scroll to */}
                <div ref={messagesEndRef} />
            </Box>

             {error && !messages.some(m => m.isError) && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

            {/* Input Area */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                    fullWidth
                    variant="outlined"
                    size="small"
                    placeholder="Ask the agent..."
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    multiline
                    maxRows={3} // Allow some vertical expansion
                />
                <Button
                    variant="contained"
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    sx={{ minWidth: 'auto', p: '10px' }} // Make button square-ish
                    aria-label="Send message"
                >
                    {isLoading ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
                </Button>
            </Box>
        </Paper>
    );
}

export default ChatbotInterface; 