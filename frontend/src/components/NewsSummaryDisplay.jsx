import React, { useEffect } from 'react';
import { FaRegSmile, FaRegFrown, FaRegMeh, FaExclamationCircle, FaExternalLinkAlt, FaSync } from "react-icons/fa";
import './NewsSummaryDisplay.css';

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

const NewsSummaryDisplay = ({ 
    newsData, 
    sourceName, 
    isLoading, 
    handleSummarize, 
    handleAnalyzeSentiment,
    llmLoading,
    llmResults,
    llmError
}) => {
    useEffect(() => {
        console.log("NewsData received:", newsData);
    }, [newsData]);
    
    if (isLoading) {
        return <p className="no-data-message">Loading news...</p>;
    }
    
    if (!newsData || newsData.length === 0) {
        return <p className="no-data-message">No {sourceName || 'news'} summaries available.</p>;
    }

    return (
        <div className="news-summary-container">
            {newsData.map((article, index) => {
                const identifier = article.url || article.title;
                const articleResults = llmResults[identifier] || {};
                const isLoadingSentiment = llmLoading[identifier] === 'sentiment';
                const isLoadingSummary = llmLoading[identifier] === 'summarize';
                const error = llmError[identifier];
                
                // Get sentiment style if we have results
                const sentimentResult = articleResults.sentiment;
                const { icon, color, text, score } = sentimentResult 
                    ? getSentimentStyle(sentimentResult) 
                    : { icon: null, color: 'gray', text: 'Analyze', score: null };
                
                const scoreText = score !== null ? `(${score.toFixed(2)})` : '';
                const sentimentTitle = `Sentiment: ${text} ${scoreText}`;

                return (
                    <div key={article.id || article.title || index} className="news-item">
                        <div className="news-header">
                            <h4 className="news-title">{article.title}</h4>
                            
                            {sentimentResult && (
                                <span className="news-sentiment" style={{ color: color }} title={sentimentTitle}>
                                    {icon}
                                </span>
                            )}
                        </div>
                        
                        {/* Display summary if available */}
                        {articleResults.summary && (
                            <div className="news-summary-result">
                                <p>{articleResults.summary}</p>
                            </div>
                        )}
                        
                        {/* Show original description/content if no summary */}
                        {!articleResults.summary && (
                            <p className="news-summary">
                                {article.description || article.content || 'No description available'}
                            </p>
                        )}
                        
                        <div className="news-footer">
                            <span className="news-source">Source: {article.source || 'N/A'}</span>
                            
                            <div className="news-actions">
                                {/* Sentiment Analysis Button */}
                                <button 
                                    className="news-action-btn" 
                                    onClick={() => handleAnalyzeSentiment(article)}
                                    disabled={isLoadingSentiment || isLoadingSummary}
                                    title="Analyze sentiment"
                                >
                                    {isLoadingSentiment ? <FaSync className="rotating" /> : sentimentResult ? icon : "Sentiment"}
                                </button>
                                
                                {/* Summarize Button */}
                                <button 
                                    className="news-action-btn" 
                                    onClick={() => handleSummarize(article)}
                                    disabled={isLoadingSentiment || isLoadingSummary}
                                    title="Summarize article"
                                >
                                    {isLoadingSummary ? <FaSync className="rotating" /> : (articleResults.summary ? "Updated" : "Summarize")}
                                </button>
                                
                                {/* Read More Link */}
                                {article.url && 
                                    <a href={article.url} target="_blank" rel="noopener noreferrer" className="news-link" title="Read full article">
                                        Read more <FaExternalLinkAlt size=".7em"/>
                                    </a>
                                }
                            </div>
                        </div>
                        
                        {/* Display error if present */}
                        {error && <div className="news-error">{error}</div>}
                    </div>
                );
            })}
        </div>
    );
};

export default NewsSummaryDisplay; 