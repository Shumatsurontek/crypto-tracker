import os
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import logging
from datetime import datetime
import time # Added for latency tracking

# --- Basic Setup ---
load_dotenv()
app = Flask(__name__)

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- CORS Configuration ---
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}})

# --- Configuration & API Keys ---
ETHERSCAN_API_KEY = os.getenv('ETHERSCAN_API_KEY', 'YOUR_ETHERSCAN_API_KEY')
COINGECKO_API_URL = 'https://api.coingecko.com/api/v3'
ETHERSCAN_API_URL = 'https://api.etherscan.io/api'
HUGGINGFACE_API_KEY = os.getenv('HUGGINGFACE_API_KEY')
HUGGINGFACE_INFERENCE_API_URL = "https://api-inference.huggingface.co/models/"
SUMMARIZATION_MODEL = os.getenv('SUMMARIZATION_MODEL', "facebook/bart-large-cnn")
SENTIMENT_MODEL = os.getenv('SENTIMENT_MODEL', "distilbert-base-uncased-finetuned-sst-2-english")
CRYPTOPANIC_API_KEY = os.getenv('CRYPTOPANIC_API_KEY')
CRYPTOPANIC_API_URL = 'https://cryptopanic.com/api/v1'
FMP_API_KEY = os.getenv('FMP_API_KEY')
FMP_API_URL = 'https://financialmodelingprep.com/api/v3'
NEWSAPI_API_KEY = os.getenv('NEWSAPI_API_KEY')
NEWSAPI_URL = 'https://newsapi.org/v2'

# --- Metrics Store ---
llm_metrics = {
    "summarization": {"model": SUMMARIZATION_MODEL, "calls": 0, "failures": 0, "success": 0, "total_latency_ms": 0},
    "sentiment": {"model": SENTIMENT_MODEL, "calls": 0, "failures": 0, "success": 0, "total_latency_ms": 0},
}

logs_store = [] # Keep simple log store for now
MAX_LOGS = 100

# --- Helper Functions ---

def make_request(url, params=None, headers=None, method='GET', json_data=None, timeout=15):
    """Makes an HTTP request and handles common errors."""
    try:
        logger.debug(f"Making {method} request to {url} with params {params} data {json_data}")
        response = requests.request(method, url, params=params, headers=headers, json=json_data, timeout=timeout)
        response.raise_for_status()
        # Handle cases where response might be empty or not JSON
        if response.content:
             try:
                 return response.json()
             except requests.exceptions.JSONDecodeError:
                 logger.warning(f"Non-JSON response received from {url}: {response.text[:100]}")
                 return response.text # Return raw text if not JSON
        else:
             return None # Return None for empty response
    except requests.exceptions.Timeout:
        logger.error(f"Timeout error requesting {url}")
        raise requests.exceptions.Timeout(f"Request timed out: {url}")
    except requests.exceptions.HTTPError as http_err:
        logger.error(f"HTTP error occurred: {http_err} - Status: {http_err.response.status_code} - Response: {http_err.response.text[:200]}")
        raise http_err
    except requests.exceptions.RequestException as req_err:
        logger.error(f"Request error occurred: {req_err}")
        raise req_err
    except Exception as e:
        logger.error(f"An unexpected error occurred during request to {url}: {e}")
        raise e

def call_huggingface_inference(model_id, payload, task_type):
    """Calls Hugging Face Inference API, tracks metrics, handles errors."""
    global llm_metrics
    if not HUGGINGFACE_API_KEY:
        logger.error(f"Hugging Face API key not configured. Cannot perform {task_type}.")
        raise ValueError("Hugging Face API key missing")

    api_url = f"{HUGGINGFACE_INFERENCE_API_URL}{model_id}"
    headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}", "Content-Type": "application/json"}

    start_time = time.time()
    llm_metrics[task_type]["calls"] += 1
    try:
        # Use a longer timeout for potentially slow LLM inferences
        # HF suggests waiting for model loading with 503 errors, implement retry later if needed
        response_data = make_request(api_url, method='POST', json_data=payload, headers=headers, timeout=60)
        latency_ms = int((time.time() - start_time) * 1000)
        llm_metrics[task_type]["success"] += 1
        llm_metrics[task_type]["total_latency_ms"] += latency_ms
        logger.info(f"Hugging Face {task_type} call successful for model {model_id} in {latency_ms}ms.")
        return response_data
    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        llm_metrics[task_type]["failures"] += 1
        llm_metrics[task_type]["total_latency_ms"] += latency_ms # Still record latency on failure
        logger.error(f"Hugging Face {task_type} API call failed for model {model_id}: {e}")
        raise e # Re-raise to be caught by the endpoint handler

# --- API Endpoints ---

@app.route('/')
def index():
    logger.info("Root endpoint accessed")
    return jsonify({"message": "Welcome to the Crypto Tracker Python Backend!"})

# --- Market Data Endpoints ---
@app.route('/api/market/fear-greed', methods=['GET'])
def get_fear_greed():
    logger.info("Fetching Fear & Greed index...")
    url = 'https://api.alternative.me/fng/?limit=1'
    try:
        data = make_request(url)
        if data and 'data' in data and len(data['data']) > 0:
            logger.info("Fear & Greed data fetched successfully.")
            return jsonify(data['data'][0])
        else:
            logger.error(f"Fear & Greed API returned unexpected data format: {data}")
            return jsonify({"error": "Invalid data format from Fear & Greed API"}), 500
    except Exception as e:
        logger.error(f"Error processing Fear & Greed data: {e}")
        return jsonify({"error": "Failed to fetch Fear & Greed data", "details": str(e)}), 500

# Renamed endpoint and function, fetches Dow Jones (^DJI) instead of S&P 500
@app.route('/api/market/index', methods=['GET'])
def get_market_index():
    index_symbol = "^DJI" # Changed to Dow Jones
    logger.info(f"Fetching Market Index data ({index_symbol})...")
    if not FMP_API_KEY:
        logger.error("FMP API key not configured.")
        return jsonify({"error": "API key for Financial Modeling Prep not configured"}), 500

    # URL encode the symbol
    encoded_symbol = requests.utils.quote(index_symbol)
    url = f"{FMP_API_URL}/quote/{encoded_symbol}"
    params = {'apikey': FMP_API_KEY}
    try:
        data = make_request(url, params=params)
        if data and isinstance(data, list) and len(data) > 0:
            index_data = data[0]
            result = { # Map fields
                "symbol": index_data.get("symbol"),
                "name": index_data.get("name"),
                "price": index_data.get("price"),
                "changesPercentage": index_data.get("changesPercentage"),
                "change": index_data.get("change"),
                "dayLow": index_data.get("dayLow"),
                "dayHigh": index_data.get("dayHigh"),
                "yearHigh": index_data.get("yearHigh"),
                "yearLow": index_data.get("yearLow"),
                "marketCap": index_data.get("marketCap"),
                "volume": index_data.get("volume"),
                "timestamp": index_data.get("timestamp")
            }
            logger.info(f"Market Index ({index_symbol}) data fetched successfully.")
            return jsonify(result)
        else:
            logger.error(f"FMP API returned unexpected data format for {index_symbol}: {data}")
            return jsonify({"error": f"Invalid data format from FMP API for {index_symbol}"}), 500
    except requests.exceptions.HTTPError as http_err:
        # Handle potential 403 for DJI too, just in case plan changes
        if http_err.response.status_code == 403:
            logger.warning(f"FMP API returned 403 Forbidden for {index_symbol} (check API plan).")
            return jsonify({"error": f"Market Index ({index_symbol}) data unavailable on current API plan."}), 403
        else:
             logger.error(f"HTTP error processing {index_symbol} data: {http_err}")
             return jsonify({"error": f"Failed to fetch {index_symbol} data", "details": str(http_err)}), http_err.response.status_code
    except Exception as e:
        logger.error(f"Error processing {index_symbol} data: {e}")
        return jsonify({"error": f"Failed to fetch {index_symbol} data", "details": str(e)}), 500


# --- News Endpoints ---
@app.route('/api/news/crypto', methods=['GET'])
def get_crypto_news():
    # ... (Keep implementation as before) ...
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

@app.route('/api/news/world', methods=['GET'])
def get_world_news():
    # ... (Keep implementation as before) ...
    logger.info("Fetching world news from NewsAPI...")
    if not NEWSAPI_API_KEY:
        logger.error("NewsAPI key not configured.")
        return jsonify({"error": "API key for NewsAPI not configured"}), 500

    url = f"{NEWSAPI_URL}/top-headlines"
    params = {'apiKey': NEWSAPI_API_KEY,'category': 'general','language': 'en','pageSize': 15}
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
    except requests.exceptions.HTTPError as http_err:
        if http_err.response.status_code == 401:
             logger.error("NewsAPI request unauthorized. Check API key.")
             return jsonify({"error": "NewsAPI request unauthorized. Check API key.", "details": str(http_err)}), 401
        else:
             logger.error(f"HTTP error processing NewsAPI data: {http_err}")
             return jsonify({"error": "Failed to fetch world news", "details": str(http_err)}), http_err.response.status_code
    except Exception as e:
        logger.error(f"Error processing NewsAPI data: {e}")
        return jsonify({"error": "Failed to fetch world news", "details": str(e)}), 500


# --- LLM Endpoints ---
@app.route('/api/news/summarize', methods=['POST'])
def summarize_news():
    """Summarizes provided text using Hugging Face."""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    data = request.get_json()
    text_to_summarize = data.get('text')
    if not text_to_summarize:
        return jsonify({"error": "Missing 'text' field in request body"}), 400

    logger.info(f"Received request to summarize text (length: {len(text_to_summarize)})...")
    payload = {"inputs": text_to_summarize, "parameters": {"min_length": 20, "max_length": 100}} # Adjust params as needed
    try:
        summary_data = call_huggingface_inference(SUMMARIZATION_MODEL, payload, "summarization")
        # The structure of summary_data depends on the model, often a list with a dict
        if isinstance(summary_data, list) and len(summary_data) > 0 and 'summary_text' in summary_data[0]:
             summary = summary_data[0]['summary_text']
             logger.info("Summarization successful.")
             return jsonify({"summary": summary})
        else:
             logger.error(f"Unexpected response format from summarization model: {summary_data}")
             return jsonify({"error": "Failed to parse summary from model response"}), 500
    except ValueError as ve: # Catch missing API key error
        return jsonify({"error": str(ve)}), 503 # Service Unavailable
    except Exception as e:
        logger.error(f"Error during summarization: {e}")
        # Provide more specific error if possible (e.g., based on HTTP status from HF)
        return jsonify({"error": "Summarization failed", "details": str(e)}), 500

@app.route('/api/sentiment/analyze', methods=['POST'])
def analyze_sentiment():
    """Analyzes sentiment of provided text using Hugging Face."""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    data = request.get_json()
    text_to_analyze = data.get('text')
    if not text_to_analyze:
        return jsonify({"error": "Missing 'text' field in request body"}), 400

    logger.info(f"Received request to analyze sentiment for text (length: {len(text_to_analyze)})...")
    payload = {"inputs": text_to_analyze} # Simple payload for most sentiment models
    try:
        sentiment_data = call_huggingface_inference(SENTIMENT_MODEL, payload, "sentiment")
        # Structure depends on model, often [[{'label': 'POSITIVE', 'score': 0.99}]]
        if isinstance(sentiment_data, list) and len(sentiment_data) > 0 and isinstance(sentiment_data[0], list):
             # Extract top result
             results = sentiment_data[0]
             # You might want to return all results or just the highest score
             top_result = max(results, key=lambda x: x['score']) if results else None
             logger.info("Sentiment analysis successful.")
             return jsonify({"sentiment_results": results, "top_sentiment": top_result})
        else:
             logger.error(f"Unexpected response format from sentiment model: {sentiment_data}")
             return jsonify({"error": "Failed to parse sentiment from model response"}), 500
    except ValueError as ve: # Catch missing API key error
        return jsonify({"error": str(ve)}), 503 # Service Unavailable
    except Exception as e:
        logger.error(f"Error during sentiment analysis: {e}")
        return jsonify({"error": "Sentiment analysis failed", "details": str(e)}), 500


# --- Admin/Metrics Endpoints ---
@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    logger.info("Metrics endpoint accessed.")
    # Calculate average latency where calls > 0
    metrics_copy = {}
    for task, data in llm_metrics.items():
        metrics_copy[task] = data.copy() # Create a copy to avoid modifying original
        if data["calls"] > 0:
            metrics_copy[task]["average_latency_ms"] = round(data["total_latency_ms"] / data["calls"])
        else:
            metrics_copy[task]["average_latency_ms"] = 0
    return jsonify(metrics_copy)

@app.route('/api/logs', methods=['GET'])
def get_logs():
    logger.info("Logs endpoint accessed.")
    # Simple in-memory log retrieval
    return jsonify({"logs": logs_store})


# TODO: Implement /api/portfolio/<address>


# --- Main Execution ---
if __name__ == '__main__':
    # This block is less relevant when run via Flask/Gunicorn command in Docker.
    # The actual run command is handled by Docker/Compose.
    pass