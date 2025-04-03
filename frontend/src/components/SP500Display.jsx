import React from 'react';
import './SP500Display.css'; // CSS file for styling

const SP500Display = ({ data }) => {
    if (!data) {
        return <div>No S&P 500 data available.</div>;
    }

    const price = data.price;
    const change = data.change;
    const percentageChange = data.changesPercentage;
    const timestamp = new Date(data.timestamp);

    const changeColor = change >= 0 ? 'var(--color-positive, #198754)' : 'var(--color-negative, #dc3545)';
    const changeSign = change >= 0 ? '+' : '';

    return (
        <div className="sp500-container">
            <div className="sp500-price">
                {price ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}
            </div>
            <div className="sp500-change" style={{ color: changeColor }}>
                {changeSign}{change ? change.toFixed(2) : 'N/A'} ({changeSign}{percentageChange ? percentageChange.toFixed(2) : 'N/A'}%)
            </div>
            <div className="sp500-timestamp">
                As of: {timestamp.toLocaleTimeString()}
            </div>
        </div>
    );
};

export default SP500Display; 