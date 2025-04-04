import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

// Function to format numbers (similar to App.jsx one maybe move to utils)
const formatCurrency = (value) => {
    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};
const formatPercent = (value) => {
     if (typeof value !== 'number' || isNaN(value)) return 'N/A';
     return `${value.toFixed(2)}%`;
};

const MarketIndexDisplay = ({ data }) => {
  if (!data || data.error) { // Handle case where data might have an error property
    return <Typography variant="body2" color="text.secondary">Data unavailable.</Typography>;
  }

  const price = data.price;
  const change = data.change;
  const percentageChange = data.changesPercentage;
  const isPositive = typeof change === 'number' && change >= 0;
  const changeColor = isPositive ? 'success.main' : 'error.main'; // Use theme colors

  return (
    <Box sx={{ mt: 1 }}>
        <Typography variant="h4" component="div" sx={{ fontWeight: 'medium', mb: 0.5 }}>
            {formatCurrency(price)}
        </Typography>
         <Stack direction="row" spacing={1} alignItems="center">
            {typeof change === 'number' ? (
                isPositive ? <ArrowUpwardIcon sx={{ color: changeColor, fontSize: '1.1rem' }}/> : <ArrowDownwardIcon sx={{ color: changeColor, fontSize: '1.1rem' }}/>
            ) : null}
            <Typography variant="body1" sx={{ color: changeColor, fontWeight: 'medium' }}>
                 {typeof change === 'number' ? `${isPositive ? '+' : ''}${change.toFixed(2)}` : 'N/A'}
            </Typography>
            <Typography variant="body1" sx={{ color: changeColor, fontWeight: 'medium' }}>
                ({formatPercent(percentageChange)})
            </Typography>
         </Stack>
         <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
             {data.name || 'Dow Jones'} - Last updated: {data.timestamp ? new Date(data.timestamp * 1000).toLocaleTimeString() : 'N/A'}
         </Typography>
         {/* Add more details like day high/low if needed */}
         {/* <Stack direction="row" spacing={2} sx={{mt: 1}}>
             <Typography variant="caption">Low: {formatCurrency(data.dayLow)}</Typography>
             <Typography variant="caption">High: {formatCurrency(data.dayHigh)}</Typography>
         </Stack> */}
    </Box>
  );
};

export default MarketIndexDisplay; 