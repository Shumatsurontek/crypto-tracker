import React from 'react';
import { FaRegSmile, FaRegFrown, FaRegMeh, FaExclamationCircle, FaExternalLinkAlt } from "react-icons/fa"; // Added Link icon
import './NewsSummaryDisplay.css'; // We'll create this CSS file

// Helper function to get icon and color based on sentiment label
const getSentimentStyle = (sentiment) => {
    if (!sentiment || sentiment.label === 'ERROR') {
        // Consistent styling for error/unavailable sentiment
        return { icon: <FaExclamationCircle />, color: 'var(--text-secondary, gray)', text: 'Sentiment Error', score: null };
    }
    
    const label = sentiment.label.toUpperCase(); 
    const score = sentiment.score;
    let icon, color, text;

    if (label === 'POSITIVE') {
        if (score > 0.75) { // Higher confidence threshold for clear positive
             icon = <FaRegSmile />;
             color = 'var(--color-positive, green)';
             text = 'Positive';
        } else {
             icon = <FaRegMeh />;
             color = 'var(--text-secondary, gray)';
             text = 'Neutral';
        }
    } else if (label === 'NEGATIVE') {
         if (score > 0.75) { // Higher confidence threshold
             icon = <FaRegFrown />;
             color = 'var(--color-negative, red)';
             text = 'Negative';
         } else {
            icon = <FaRegMeh />;
             color = 'var(--text-secondary, gray)';
             text = 'Neutral';
         }
    } else {
        icon = <FaRegMeh />;
        color = 'var(--text-secondary, gray)';
        text = 'Neutral';
    }
    return { icon, color, text, score };
};

const NewsSummaryDisplay = ({ articles, sourceName }) => { // Added sourceName prop
    if (!articles || articles.length === 0) {
        return <p className="no-data-message">No {sourceName || 'news'} summaries available.</p>;
    }

    return (
        <div className="news-summary-container">
            {articles.map(article => {
                 const { icon, color, text, score } = getSentimentStyle(article.sentiment);
                 const scoreText = score !== null ? `(${score.toFixed(2)})` : '';
                 const sentimentTitle = `Sentiment: ${text} ${scoreText}`;

                 return (
                    <div key={article.id || article.title} className="news-item">
                        <div className="news-header">
                            <h4 className="news-title">{article.title}</h4>
                            <span className="news-sentiment" style={{ color: color }} title={sentimentTitle}>
                                {icon}
                            </span>
                        </div>
                        <p className="news-summary">{article.summary}</p>
                        <div className="news-footer">
                            <span className="news-source">Source: {article.source || 'N/A'}</span>
                             {article.url && 
                                <a href={article.url} target="_blank" rel="noopener noreferrer" className="news-link" title="Read full article">
                                    Read more <FaExternalLinkAlt size=".7em"/>
                                </a>
                            }
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default NewsSummaryDisplay; 