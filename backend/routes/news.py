from flask import Blueprint, jsonify, request
import logging
from utils.api_client import make_request
from utils.config import (
    CRYPTOPANIC_API_KEY, CRYPTOPANIC_API_URL,
    NEWSAPI_API_KEY, NEWSAPI_URL,
    HUGGINGFACE_API_KEY, HUGGINGFACE_INFERENCE_API_URL,
    SUMMARIZATION_MODEL
)
import time

# Configure logger
logger = logging.getLogger(__name__)

# Create blueprint
news_routes = Blueprint('news', __name__)

@news_routes.route('/crypto', methods=['GET'])
def get_crypto_news():
    """Get latest crypto news from Cryptopanic"""
    logger.info("Fetching crypto news from Cryptopanic...")
    if not CRYPTOPANIC_API_KEY:
        logger.error("Cryptopanic API key not configured.")
        return jsonify({"error": "API key for Cryptopanic not configured"}), 500

    url = f"{CRYPTOPANIC_API_URL}/posts/"
    params = {'auth_token': CRYPTOPANIC_API_KEY, 'public': 'true'}
    
    try:
        data = make_request(url, params=params)
        if data and 'results' in data:
            articles = [{
                "source": article.get("source", {}).get("title"),
                "domain": article.get("source", {}).get("domain"),
                "title": article.get("title"),
                "published_at": article.get("published_at"),
                "url": article.get("url"),
                "currencies": [c.get("code") for c in article.get("currencies", []) if c],
            } for article in data['results'][:15]]
            logger.info(f"Fetched {len(articles)} crypto news articles.")
            return jsonify({"articles": articles})
        else:
            logger.error(f"Cryptopanic API returned unexpected data format: {data}")
            return jsonify({"error": "Invalid data format from Cryptopanic API"}), 500
    except Exception as e:
        logger.error(f"Error processing Cryptopanic news data: {e}")
        return jsonify({"error": "Failed to fetch crypto news", "details": str(e)}), 500

@news_routes.route('/world', methods=['GET'])
def get_world_news():
    """Get latest world news from NewsAPI"""
    logger.info("Fetching world news from NewsAPI...")
    if not NEWSAPI_API_KEY:
        logger.error("NewsAPI key not configured.")
        return jsonify({"error": "API key for NewsAPI not configured"}), 500

    url = f"{NEWSAPI_URL}/top-headlines"
    params = {'apiKey': NEWSAPI_API_KEY, 'category': 'general', 'language': 'en', 'pageSize': 15}
    headers = {'Accept': 'application/json'}
    
    try:
        data = make_request(url, params=params, headers=headers)
        if data and 'articles' in data:
            articles = [{
                "source": article.get("source", {}).get("name"),
                "author": article.get("author"),
                "title": article.get("title"),
                "description": article.get("description"),
                "url": article.get("url"),
                "urlToImage": article.get("urlToImage"),
                "publishedAt": article.get("publishedAt"),
                "content": article.get("content")
            } for article in data['articles']]
            logger.info(f"Fetched {len(articles)} world news articles.")
            return jsonify({"articles": articles})
        else:
            logger.error(f"NewsAPI returned unexpected data format: {data}")
            return jsonify({"error": "Invalid data format from NewsAPI"}), 500
    except Exception as e:
        logger.error(f"Error processing NewsAPI data: {e}")
        return jsonify({"error": "Failed to fetch world news", "details": str(e)}), 500

@news_routes.route('/summarize', methods=['POST'])
def summarize_news():
    """Summarizes provided text using a selected or default Hugging Face model"""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    
    data = request.get_json()
    text_to_summarize = data.get('text')
    model_id_req = data.get('model_id')
    
    if not text_to_summarize:
        return jsonify({"error": "Missing 'text' field"}), 400
    
    logger.info(f"Received request to summarize text (model: {model_id_req or 'default'}). Text length: {len(text_to_summarize)}")

    if not HUGGINGFACE_API_KEY:
        logger.error("Hugging Face API key not configured.")
        return jsonify({"error": "API key for Hugging Face not configured"}), 500

    try:
        # Use the requested model or fall back to default
        model_id = model_id_req if model_id_req else SUMMARIZATION_MODEL
        url = f"{HUGGINGFACE_INFERENCE_API_URL}{model_id}"
        headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}"}
        payload = {"inputs": text_to_summarize, "parameters": {"max_length": 150, "min_length": 30}}
        
        # Track time
        start_time = time.time()
        summary_data = make_request(url, headers=headers, method='POST', json_data=payload)
        execution_time = time.time() - start_time
        
        if isinstance(summary_data, list) and len(summary_data) > 0:
            summary = summary_data[0].get('summary_text', '')
            logger.info(f"Summarization successful. Summary length: {len(summary)}")
            
            # Update metrics
            try:
                from routes.llm import update_metrics
                update_metrics("summarization", execution_time)
            except ImportError:
                logger.info("Metrics tracking not available for summarization")
                
            return jsonify({"summary": summary})
        else:
            logger.error(f"Unexpected response format from summarization model: {summary_data}")
            
            # Update error metrics
            try:
                from routes.llm import update_metrics
                update_metrics("summarization", execution_time, error=True)
            except ImportError:
                logger.info("Error metrics tracking not available for summarization")
                
            return jsonify({"error": "Failed to generate summary"}), 500
    except Exception as e:
        execution_time = time.time() - start_time if 'start_time' in locals() else 0
        logger.error(f"Error during summarization: {e}")
        
        # Update error metrics
        try:
            from routes.llm import update_metrics
            update_metrics("summarization", execution_time, error=True)
        except ImportError:
            logger.info("Error metrics tracking not available for summarization")
            
        return jsonify({"error": "Failed to summarize text", "details": str(e)}), 500

@news_routes.route('/sentiment/analyze', methods=['POST'])
def analyze_sentiment():
    """Analyzes sentiment of provided text using Hugging Face model"""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    
    data = request.get_json()
    text_to_analyze = data.get('text')
    model_id_req = data.get('model_id')
    
    if not text_to_analyze:
        return jsonify({"error": "Missing 'text' field"}), 400
    
    logger.info(f"Received request to analyze sentiment (model: {model_id_req or 'default'}). Text length: {len(text_to_analyze)}")

    if not HUGGINGFACE_API_KEY:
        logger.error("Hugging Face API key not configured.")
        return jsonify({"error": "API key for Hugging Face not configured"}), 500

    try:
        # Use the requested model or fall back to default sentiment model
        model_id = model_id_req if model_id_req else "distilbert-base-uncased-finetuned-sst-2-english"
        url = f"{HUGGINGFACE_INFERENCE_API_URL}{model_id}"
        headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}"}
        payload = {"inputs": text_to_analyze}
        
        # Track time
        start_time = time.time()
        sentiment_data = make_request(url, headers=headers, method='POST', json_data=payload)
        execution_time = time.time() - start_time
        
        if isinstance(sentiment_data, list) and len(sentiment_data) > 0:
            # Handle output format based on model
            result = sentiment_data[0]
            
            # Most sentiment models return a list of label/score pairs
            if isinstance(result, list):
                # Find the label with highest score
                sentiment = max(result, key=lambda x: x['score'])
                label = sentiment['label'].upper()
                score = sentiment['score']
                
                # Normalize labels to POSITIVE/NEGATIVE
                if 'POSITIVE' in label or 'POS' in label:
                    normalized_label = 'POSITIVE'
                elif 'NEGATIVE' in label or 'NEG' in label:
                    normalized_label = 'NEGATIVE'
                else:
                    normalized_label = 'NEUTRAL'
                
                logger.info(f"Sentiment analysis successful: {normalized_label} ({score:.2f})")
                
                # Update metrics
                try:
                    from routes.llm import update_metrics
                    update_metrics("sentiment", execution_time)
                except ImportError:
                    logger.info("Metrics tracking not available for sentiment analysis")
                
                return jsonify({
                    "sentiment": {
                        "label": normalized_label,
                        "score": score,
                        "raw_label": label
                    }
                })
            else:
                logger.error(f"Unexpected response format from sentiment model: {sentiment_data}")
                
                # Update error metrics
                try:
                    from routes.llm import update_metrics
                    update_metrics("sentiment", execution_time, error=True)
                except ImportError:
                    logger.info("Error metrics tracking not available for sentiment analysis")
                    
                return jsonify({"error": "Failed to analyze sentiment"}), 500
        else:
            logger.error(f"Unexpected response format from sentiment model: {sentiment_data}")
            
            # Update error metrics
            try:
                from routes.llm import update_metrics
                update_metrics("sentiment", execution_time, error=True)
            except ImportError:
                logger.info("Error metrics tracking not available for sentiment analysis")
                
            return jsonify({"error": "Failed to analyze sentiment"}), 500
    except Exception as e:
        execution_time = time.time() - start_time if 'start_time' in locals() else 0
        logger.error(f"Error during sentiment analysis: {e}")
        
        # Update error metrics
        try:
            from routes.llm import update_metrics
            update_metrics("sentiment", execution_time, error=True)
        except ImportError:
            logger.info("Error metrics tracking not available for sentiment analysis")
            
        return jsonify({"error": "Failed to analyze sentiment", "details": str(e)}), 500 