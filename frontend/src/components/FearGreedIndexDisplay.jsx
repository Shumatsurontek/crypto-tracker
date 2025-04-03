import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import GaugeChart from 'react-gauge-chart'; // Assuming you use this or similar

const FearGreedIndexDisplay = ({ data }) => {
    if (!data || !data.value) {
        return <Typography variant="body2" color="text.secondary">No data available.</Typography>;
    }

    const value = parseInt(data.value, 10);
    const classification = data.value_classification || 'N/A';
    const timestamp = data.timestamp ? new Date(parseInt(data.timestamp, 10) * 1000) : null;

    // Determine color based on value (example)
    let color;
    if (value <= 25) color = '#dc3545'; // Extreme Fear (Red)
    else if (value <= 45) color = '#ffc107'; // Fear (Orange/Yellow)
    else if (value <= 55) color = '#6c757d'; // Neutral (Gray)
    else if (value <= 75) color = '#198754'; // Greed (Green)
    else color = '#146c43'; // Extreme Greed (Darker Green)

    return (
        <Box sx={{ textAlign: 'center', mt: 2 }}>
            {/* Use GaugeChart or a custom SVG/Canvas implementation */}
            <GaugeChart
                id="fear-greed-gauge"
                nrOfLevels={5} // Example levels
                arcsLength={[0.25, 0.2, 0.1, 0.2, 0.25]} // Adjust based on desired ranges
                colors={['#dc3545', '#ffc107', '#6c757d', '#198754', '#146c43']}
                percent={value / 100} // Convert value (0-100) to percentage (0-1)
                arcPadding={0.02}
                textColor="inherit" // Inherit text color from theme
                needleColor="#aaa" // Example needle color
                needleBaseColor="#aaa"
            />
            <Typography variant="h4" component="div" sx={{ mt: -4, fontWeight: 'bold', color: color }}>
                {value}
            </Typography>
            <Typography variant="h6" component="div" sx={{ mt: 1, color: color }}>
                {classification}
            </Typography>
            {timestamp && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    Last updated: {timestamp.toLocaleString()}
                </Typography>
            )}
        </Box>
    );
};

export default FearGreedIndexDisplay; 