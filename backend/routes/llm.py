from flask import Blueprint, jsonify, request
import logging
import time
from utils.config import (
    AVAILABLE_MODELS,
    HUGGINGFACE_API_KEY,
    SENTIMENT_MODELS,
    SUMMARIZATION_MODELS
)
from utils.api_client import make_request

# Configure logger
logger = logging.getLogger(__name__)

# Create blueprint
llm_routes = Blueprint('llm', __name__)

# Simple in-memory metrics storage
metrics = {
    "sentiment": {
        "calls": 0,
        "success": 0,
        "failures": 0,
        "average_time": 0
    },
    "summarization": {
        "calls": 0,
        "success": 0,
        "failures": 0,
        "average_time": 0
    },
    "chat": {
        "calls": 0,
        "success": 0,
        "failures": 0,
        "average_time": 0
    },
    "last_updated": int(time.time())
}

def update_metrics(operation, duration, error=False):
    """Update metrics for a specific LLM operation"""
    global metrics
    
    # Update call count
    metrics[operation]["calls"] = metrics[operation].get("calls", 0) + 1
    
    # Update success/error count
    if error:
        metrics[operation]["failures"] = metrics[operation].get("failures", 0) + 1
    else:
        metrics[operation]["success"] = metrics[operation].get("success", 0) + 1
    
    # Update average time
    current_avg = metrics[operation].get("average_time", 0)
    
    # Calculate new average
    if current_avg == 0:
        metrics[operation]["average_time"] = duration
    else:
        # Weighted average favoring recent calls
        metrics[operation]["average_time"] = (current_avg * 0.7) + (duration * 0.3)
    
    # Update timestamp
    metrics["last_updated"] = int(time.time())

@llm_routes.route('/models', methods=['GET'])
def get_available_models():
    """Get available LLM models for summarization and sentiment analysis"""
    
    if not HUGGINGFACE_API_KEY:
        logger.error("Hugging Face API key not configured.")
        return jsonify({"error": "API key for Hugging Face not configured"}), 500
    
    try:
        # Return list of available models from config
        return jsonify({
            "summarization": SUMMARIZATION_MODELS,
            "sentiment": SENTIMENT_MODELS
        })
    except Exception as e:
        logger.error(f"Error getting available models: {e}")
        return jsonify({"error": "Failed to get available models"}), 500

@llm_routes.route('/metrics', methods=['GET'])
def get_metrics():
    """Get LLM usage metrics"""
    try:
        return jsonify(metrics)
    except Exception as e:
        logger.error(f"Error retrieving metrics: {e}")
        return jsonify({"error": "Failed to retrieve metrics"}), 500

@llm_routes.route('/sentiment/analyze', methods=['POST'])
def analyze_sentiment():
    """Analyzes sentiment of provided text using Hugging Face models"""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    
    data = request.get_json()
    text = data.get('text')
    model_id = data.get('model_id', AVAILABLE_MODELS['sentiment'][0]['id'])
    
    if not text:
        return jsonify({"error": "Missing 'text' field"}), 400
    
    logger.info(f"Analyzing sentiment with model: {model_id}")
    
    if not HUGGINGFACE_API_KEY:
        logger.error("Hugging Face API key not configured")
        return jsonify({"error": "Hugging Face API key not configured"}), 500
    
    try:
        # Call Hugging Face API for sentiment analysis
        url = f"https://api-inference.huggingface.co/models/{model_id}"
        headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}"}
        payload = {"inputs": text}
        
        start_time = time.time()
        sentiment_data = make_request(url, headers=headers, method='POST', json_data=payload)
        duration = time.time() - start_time
        
        if isinstance(sentiment_data, list) and len(sentiment_data) > 0:
            # Format the response
            results = sentiment_data[0]
            # Find top sentiment
            top_result = max(results, key=lambda x: x['score']) if results else None
            
            logger.info(f"Sentiment analysis successful: {top_result}")
            update_metrics("sentiment", duration)
            return jsonify({
                "sentiment_results": results,
                "top_sentiment": top_result
            })
        else:
            logger.error(f"Unexpected response format: {sentiment_data}")
            update_metrics("sentiment", duration, error=True)
            return jsonify({"error": "Failed to analyze sentiment"}), 500
    
    except Exception as e:
        logger.error(f"Error during sentiment analysis: {e}")
        update_metrics("sentiment", duration, error=True)
        return jsonify({"error": f"Failed to analyze sentiment: {str(e)}"}), 500 