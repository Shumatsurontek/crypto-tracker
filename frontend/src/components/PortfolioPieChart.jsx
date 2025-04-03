import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Predefined colors for chart segments
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF19C3', '#19D7FF', '#FFD719'];

const PortfolioPieChart = ({ assets, totalValue }) => {
    // Memoize chart data transformation to avoid recalculation on every render
    const chartData = useMemo(() => {
        if (!assets || assets.length === 0 || totalValue <= 0) {
            return [];
        }

        // Prepare data for the pie chart, filter out very small values if needed
        const significantAssets = assets.filter(asset => asset.valueUSD > 0.01); // Ignore dust
        let othersValue = 0;

        // Calculate percentage and prepare chart data
        const data = significantAssets.map(asset => {
            const percentage = (asset.valueUSD / totalValue) * 100;
            // Group small assets into 'Others' if percentage is too small (e.g., < 1%)
            if (percentage < 1.0) {
                othersValue += asset.valueUSD;
                return null; // Will be filtered out
            }
            return {
                name: asset.symbol,
                value: parseFloat(asset.valueUSD.toFixed(2)), // Use value for segment size
                percentage: percentage.toFixed(1) // Store percentage for tooltip/legend
            };
        }).filter(Boolean); // Remove null entries

        // Add the 'Others' category if it has value
        if (othersValue > 0.01) {
            data.push({
                name: 'Others',
                value: parseFloat(othersValue.toFixed(2)),
                percentage: ((othersValue / totalValue) * 100).toFixed(1)
            });
        }

        // Sort data by value descending for better color distribution
        data.sort((a, b) => b.value - a.value);

        return data;
    }, [assets, totalValue]);

    if (chartData.length === 0) {
        return <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No data available for chart.</p>;
    }

    // Custom Tooltip
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="custom-tooltip" style={{
                    backgroundColor: 'var(--bg-card)', 
                    padding: '10px', 
                    border: `1px solid var(--border-color)`,
                    borderRadius: '4px',
                    boxShadow: '0 2px 5px var(--card-shadow)'
                }}>
                    <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--text-primary)' }}>{`${data.name}`}</p>
                    <p style={{ margin: '5px 0 0 0', color: 'var(--text-secondary)' }}>{`Value: $${data.value.toLocaleString()}`}</p>
                    <p style={{ margin: '5px 0 0 0', color: 'var(--text-secondary)' }}>{`(${data.percentage}%)`}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    // label={renderCustomizedLabel} // Optional: Add labels directly on slices
                    outerRadius={80} // Adjust size
                    fill="#8884d8"
                    dataKey="value" // Value determines the size of the slice
                    nameKey="name" // Name is used for legend/tooltip
                >
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    formatter={(value, entry) => (
                        <span style={{ color: 'var(--text-secondary)' }}>{value} ({entry.payload.percentage}%)</span>
                    )}
                 />
            </PieChart>
        </ResponsiveContainer>
    );
};

export default PortfolioPieChart; 