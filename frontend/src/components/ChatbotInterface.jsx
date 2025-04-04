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

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function ChatbotInterface() {
    const [messages, setMessages] = useState([]); // { sender: 'user'/'agent', text: '...' }
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const messagesEndRef = useRef(null); // To scroll to bottom

    // Scroll to bottom effect
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleInputChange = (event) => {
        setInput(event.target.value);
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
            // Call backend agent endpoint
            const response = await axios.post(`${BACKEND_URL}/api/agent/invoke`, {
                input: userMessage
            });

            // Add agent response to chat
            setMessages(prev => [...prev, { sender: 'agent', text: response.data.response }]);

        } catch (err) {
            console.error("Agent invocation error:", err);
            const errorMsg = err.response?.data?.error || 'Agent failed to respond.';
            setError(errorMsg);
             // Optionally add an error message to the chat
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

    return (
        <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 'calc(100% - 16px)' }}> {/* Adjust height as needed */}
            <Typography variant="h6" gutterBottom>Agent Chat</Typography>
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
                                bgcolor: msg.isError ? 'error.main' : (msg.sender === 'user' ? 'primary.main' : 'action.hover'),
                                color: msg.isError ? 'error.contrastText' : (msg.sender === 'user' ? 'primary.contrastText' : 'text.primary'),
                                borderRadius: msg.sender === 'user' ? '15px 15px 0 15px' : '15px 15px 15px 0',
                            }}
                        >
                             {/* Basic text display, can enhance with Markdown later */}
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {msg.text}
                            </Typography>
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