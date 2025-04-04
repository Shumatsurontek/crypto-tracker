import os
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import logging
from datetime import datetime
import time # Added for latency tracking

# --- LangChain Imports (Add these) ---
from langchain_huggingface import HuggingFaceEndpoint # Or other LLM providers
from langchain.agents import AgentExecutor, create_react_agent # Example agent type
from langchain_core.prompts import PromptTemplate # For agent prompt
from langchain_community.tools import DuckDuckGoSearchRun # Import the tool
from langchain.tools import tool # Use the @tool decorator
# Add more imports for tools, memory as needed

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

# Define available models (can be expanded later)
AVAILABLE_MODELS = {
    "summarization": [
        {"id": "facebook/bart-large-cnn", "name": "BART Large CNN (Default)"},
        {"id": "google/pegasus-xsum", "name": "PEGASUS XSUM"},
        {"id": "sshleifer/distilbart-cnn-12-6", "name": "DistilBART CNN"},
        # Add more compatible summarization models
    ],
    "sentiment": [
        {"id": "distilbert-base-uncased-finetuned-sst-2-english", "name": "DistilBERT SST-2 (Default)"},
        {"id": "cardiffnlp/twitter-roberta-base-sentiment-latest", "name": "RoBERTa Twitter"},
        {"id": "finiteautomata/bertweet-base-sentiment-analysis", "name": "BERTweet Base"},
        # Add more compatible sentiment models
    ]
}

# --- Metrics Store ---
llm_metrics = {
    "summarization": {"model": SUMMARIZATION_MODEL, "calls": 0, "failures": 0, "success": 0, "total_latency_ms": 0},
    "sentiment": {"model": SENTIMENT_MODEL, "calls": 0, "failures": 0, "success": 0, "total_latency_ms": 0},
    # Placeholder for tool usage - Initialize dynamically or update below
    "tool_usage": {}
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

def call_huggingface_inference(model_id_to_use, default_model_id, payload, task_type):
    """Calls Hugging Face Inference API, tracks metrics, handles errors."""
    global llm_metrics
    if not HUGGINGFACE_API_KEY:
        logger.error(f"Hugging Face API key not configured. Cannot perform {task_type}.")
        raise ValueError("Hugging Face API key missing")

    # Use provided model_id if valid, otherwise fallback to default from env/config
    model_id = model_id_to_use if model_id_to_use else default_model_id
    logger.info(f"Using model '{model_id}' for {task_type} task.")

    api_url = f"{HUGGINGFACE_INFERENCE_API_URL}{model_id}"
    headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}", "Content-Type": "application/json"}

    # Ensure metrics dictionary has entry for this task (using default model as key for now)
    # TODO: Optionally track metrics per specific model_id used if needed
    task_key = task_type # e.g., "summarization"
    if task_key not in llm_metrics:
         llm_metrics[task_key] = {"model": default_model_id, "calls": 0, "failures": 0, "success": 0, "total_latency_ms": 0}


    start_time = time.time()
    llm_metrics[task_key]["calls"] += 1
    try:
        response_data = make_request(api_url, method='POST', json_data=payload, headers=headers, timeout=60)
        latency_ms = int((time.time() - start_time) * 1000)
        llm_metrics[task_key]["success"] += 1
        llm_metrics[task_key]["total_latency_ms"] += latency_ms
        logger.info(f"Hugging Face {task_type} call successful for model {model_id} in {latency_ms}ms.")
        return response_data
    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        llm_metrics[task_key]["failures"] += 1
        llm_metrics[task_key]["total_latency_ms"] += latency_ms
        logger.error(f"Hugging Face {task_type} API call failed for model {model_id}: {e}")

        hf_error_details = None
        status_code = 500 # Default internal error
        if isinstance(e, requests.exceptions.HTTPError) and e.response is not None:
            status_code = e.response.status_code # Get actual status code from HF
            try:
                hf_error_details = e.response.json()
                logger.error(f"HF Error Response (JSON): {hf_error_details}")
            except requests.exceptions.JSONDecodeError:
                hf_error_details = e.response.text
                logger.error(f"HF Error Response (non-JSON): {hf_error_details[:200]}")

        # === Add specific re-raise for 503 ===
        # Re-raise with the original status code to be caught by the endpoint
        raise requests.exceptions.HTTPError(f"HF API Error ({model_id}, Status: {status_code}): {e}. Details: {hf_error_details}", response=e.response) from e

# Functions to fetch data (simplified versions - add error handling like in endpoints)
# NOTE: These should ideally reuse the logic/error handling from the existing API endpoints
# or the endpoints should be refactored to be callable internally.
def fetch_crypto_news_data():
    logger.info("[Tool] Fetching crypto news...")
    if not CRYPTOPANIC_API_KEY: return "Error: Cryptopanic API key not configured."
    url = f"{CRYPTOPANIC_API_URL}/posts/"
    params = {'auth_token': CRYPTOPANIC_API_KEY, 'public': 'true', 'posts_per_page': 5 } # Limit results for tool
    try:
        data = make_request(url, params=params)
        if data and 'results' in data:
            titles = [a.get('title', 'No Title') for a in data['results']]
            return f"Found {len(titles)} articles: " + "; ".join(titles)
        return "No crypto news articles found."
    except Exception as e:
        logger.error(f"[Tool] Crypto news fetch error: {e}")
        return f"Error fetching crypto news: {e}"

def fetch_market_index_data():
    logger.info("[Tool] Fetching market index...")
    if not FMP_API_KEY: return "Error: FMP API key not configured."
    index_symbol = "^DJI"
    encoded_symbol = requests.utils.quote(index_symbol)
    url = f"{FMP_API_URL}/quote/{encoded_symbol}"
    params = {'apikey': FMP_API_KEY}
    try:
        data = make_request(url, params=params)
        if data and isinstance(data, list) and len(data) > 0:
             idx_data = data[0]
             return f"Dow Jones Index ({idx_data.get('symbol')}): Price={idx_data.get('price')}, Change={idx_data.get('change')} ({idx_data.get('changesPercentage')}%)"
        return "Market index data not found."
    except Exception as e:
        logger.error(f"[Tool] Market index fetch error: {e}")
        return f"Error fetching market index: {e}"

# Define tools using the decorator
@tool
def search_web(query: str) -> str:
    """Searches the web using DuckDuckGo for the given query. Use this for general knowledge, current events, or topics not covered by other tools."""
    tool_name = "search_web"
    if tool_name not in llm_metrics["tool_usage"]: llm_metrics["tool_usage"][tool_name] = {"calls": 0, "errors": 0}
    llm_metrics["tool_usage"][tool_name]["calls"] += 1
    search = DuckDuckGoSearchRun()
    try:
        result = search.run(query)
        return result
    except Exception as e:
        llm_metrics["tool_usage"][tool_name]["errors"] += 1
        return f"Web search failed: {e}"

@tool
def get_latest_crypto_news_headlines(input: str = "") -> str:
    """Fetches the latest cryptocurrency news headlines. Use this specifically when asked about crypto news."""
    tool_name = "get_latest_crypto_news_headlines"
    if tool_name not in llm_metrics["tool_usage"]: llm_metrics["tool_usage"][tool_name] = {"calls": 0, "errors": 0}
    llm_metrics["tool_usage"][tool_name]["calls"] += 1
    try:
        result = fetch_crypto_news_data()
        # Check if result indicates an error
        if isinstance(result, str) and result.startswith("Error"):
             llm_metrics["tool_usage"][tool_name]["errors"] += 1
        return result
    except Exception as e:
        llm_metrics["tool_usage"][tool_name]["errors"] += 1
        return f"Error in crypto news tool: {e}"

@tool
def get_current_market_index(input: str = "") -> str:
    """Fetches the current price and change for the Dow Jones Market Index. Use this when asked about general market performance or the Dow Jones index."""
    tool_name = "get_current_market_index"
    if tool_name not in llm_metrics["tool_usage"]: llm_metrics["tool_usage"][tool_name] = {"calls": 0, "errors": 0}
    llm_metrics["tool_usage"][tool_name]["calls"] += 1
    try:
        result = fetch_market_index_data()
        if isinstance(result, str) and result.startswith("Error"):
             llm_metrics["tool_usage"][tool_name]["errors"] += 1
        return result
    except Exception as e:
         llm_metrics["tool_usage"][tool_name]["errors"] += 1
         return f"Error in market index tool: {e}"

# Re-initialize tools list with updated functions
tools = [search_web, get_latest_crypto_news_headlines, get_current_market_index]

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
@app.route('/api/llm/models', methods=['GET'])
def get_llm_models():
    """Returns the list of available LLM models."""
    logger.info("Requesting list of available LLM models.")
    return jsonify(AVAILABLE_MODELS)

@app.route('/api/news/summarize', methods=['POST'])
def summarize_news():
    """Summarizes provided text using a selected or default Hugging Face model."""
    if not request.is_json: return jsonify({"error": "Request must be JSON"}), 400
    data = request.get_json()
    text_to_summarize = data.get('text')
    # Get optional model_id from request, default to None
    model_id_req = data.get('model_id')
    if not text_to_summarize: return jsonify({"error": "Missing 'text' field"}), 400

    logger.info(f"Received request to summarize (model: {model_id_req or 'default'}). Text length: {len(text_to_summarize)}")
    payload = {"inputs": text_to_summarize, "parameters": {"min_length": 20, "max_length": 100}}
    try:
        # Pass requested model_id and the default model from config
        summary_data = call_huggingface_inference(model_id_req, SUMMARIZATION_MODEL, payload, "summarization")
        # The structure of summary_data depends on the model, often a list with a dict
        if isinstance(summary_data, list) and len(summary_data) > 0 and 'summary_text' in summary_data[0]:
             summary = summary_data[0]['summary_text']
             logger.info("Summarization successful.")
             return jsonify({"summary": summary})
        else:
             logger.error(f"Unexpected response format from summarization model: {summary_data}")
             return jsonify({"error": "Failed to parse summary from model response"}), 500
    except requests.exceptions.HTTPError as http_err:
        # Pass the status code from the error response if available
        error_status = http_err.response.status_code if http_err.response is not None else 500
        logger.error(f"HTTP Error during summarization: {http_err}")
        # Return the status code received from the underlying call (e.g., 503 from HF)
        return jsonify({"error": f"Summarization failed", "details": str(http_err)}), error_status
    except ValueError as ve: return jsonify({"error": str(ve)}), 503 # Existing API key check
    except Exception as e:
        logger.error(f"Unexpected Error during summarization: {e}", exc_info=True)
        return jsonify({"error": f"An unexpected error occurred during summarization", "details": str(e)}), 500

@app.route('/api/sentiment/analyze', methods=['POST'])
def analyze_sentiment():
    """Analyzes sentiment using a selected or default Hugging Face model."""
    if not request.is_json: return jsonify({"error": "Request must be JSON"}), 400
    data = request.get_json()
    text_to_analyze = data.get('text')
     # Get optional model_id from request, default to None
    model_id_req = data.get('model_id')
    if not text_to_analyze: return jsonify({"error": "Missing 'text' field"}), 400

    logger.info(f"Received request to analyze sentiment (model: {model_id_req or 'default'}). Text length: {len(text_to_analyze)}")
    payload = {"inputs": text_to_analyze}
    try:
        # Pass requested model_id and the default model from config
        sentiment_data = call_huggingface_inference(model_id_req, SENTIMENT_MODEL, payload, "sentiment")
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
    except requests.exceptions.HTTPError as http_err:
        # Pass the status code from the error response if available
        error_status = http_err.response.status_code if http_err.response is not None else 500
        logger.error(f"HTTP Error during sentiment analysis: {http_err}")
        # Return the status code received from the underlying call (e.g., 503 from HF)
        return jsonify({"error": f"Sentiment analysis failed", "details": str(http_err)}), error_status
    except ValueError as ve: return jsonify({"error": str(ve)}), 503 # Existing API key check
    except Exception as e:
        logger.error(f"Unexpected Error during sentiment analysis: {e}", exc_info=True)
        return jsonify({"error": f"An unexpected error occurred during sentiment analysis", "details": str(e)}), 500


# --- Admin/Metrics Endpoints ---
@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    logger.info("Metrics endpoint accessed.")
    metrics_copy = {}
    # Calculate LLM averages
    for task, data in llm_metrics.items():
        if task == 'tool_usage': continue # Skip tool usage for now
        metrics_copy[task] = data.copy()
        if data.get("calls", 0) > 0:
            metrics_copy[task]["average_latency_ms"] = round(data["total_latency_ms"] / data["calls"])
        else:
            metrics_copy[task]["average_latency_ms"] = 0

    # Add tool usage data directly
    metrics_copy['tool_usage'] = llm_metrics.get('tool_usage', {})

    return jsonify(metrics_copy)

@app.route('/api/logs', methods=['GET'])
def get_logs():
    logger.info("Logs endpoint accessed.")
    # Simple in-memory log retrieval
    return jsonify({"logs": logs_store})


# TODO: Implement /api/portfolio/<address>


# --- LangChain Setup ---

# Revert to Mistral for stability while fixing UI/Data
LLM_REPO_ID = "mistralai/Mistral-7B-Instruct-v0.1"
logger.info(f"Initializing LLM ({LLM_REPO_ID}) via HuggingFaceEndpoint.")

try:
    if not HUGGINGFACE_API_KEY:
        raise ValueError("Hugging Face API key not found in environment variables.")

    llm = HuggingFaceEndpoint(
        repo_id=LLM_REPO_ID,
        max_new_tokens=512,
        temperature=0.7,
        huggingfacehub_api_token=HUGGINGFACE_API_KEY
    )
    logger.info(f"LangChain LLM initialized with {LLM_REPO_ID}.")
except Exception as e:
    logger.error(f"Failed to initialize LangChain LLM ({LLM_REPO_ID}): {e}")
    llm = None

# Define tools
try:
    search_tool = DuckDuckGoSearchRun()
    tools = [search_tool]
    # TODO: Add custom tools here later if needed (e.g., crypto news fetcher tool)
    logger.info(f"LangChain tools initialized: {[tool.name for tool in tools]}")
except Exception as e:
    logger.error(f"Failed to initialize LangChain tools: {e}")
    tools = [] # Ensure tools is an empty list on failure

# Agent Prompt Template (Slightly more explicit instruction)
react_prompt_template = """
You are a helpful financial and crypto assistant. Answer the user's questions based on your knowledge and the tools available.

**Instructions:**
1.  If the question is a simple greeting, conversational remark, or something you can answer directly from your general knowledge, answer it directly without using tools.
2.  If the question requires specific information, use the appropriate tool.
3.  Explain your reasoning briefly in the 'Thought' step.

**Available Tools:**
{tools}

**Output Format:**
Question: the input question you must answer
Thought: Brief reasoning about whether to use a tool and which one, or if answering directly.
Action: (ONLY if using a tool) The action to take, MUST be exactly one of the tool names [{tool_names}]
Action Input: (ONLY if using a tool) The input string to the action/tool.
Observation: (ONLY if using a tool) the result of the action
Thought: (If tool was used) Analyze the observation. I now know the final answer. OR (If no tool needed) I can answer directly.
Final Answer: Your final response to the user.

Begin!

Question: {input}
Thought:{agent_scratchpad}""" # Note: Removed the extra space before {agent_scratchpad} just in case
prompt = PromptTemplate.from_template(react_prompt_template)


# Create Agent (Ensure handle_parsing_errors is robust)
agent = None
agent_executor = None
if llm and tools:
    try:
        agent = create_react_agent(llm, tools, prompt)
        # More descriptive parsing error message for the LLM to potentially self-correct
        agent_executor = AgentExecutor(
            agent=agent,
            tools=tools,
            verbose=True,
            # Try feeding the parsing error back to the LLM
            handle_parsing_errors="Please ensure your output strictly follows the required Action/Action Input/Observation format when using tools.",
            max_iterations=10 # Add a safety limit on iterations
        )
        logger.info("LangChain ReAct agent executor initialized.")
    except Exception as e:
        logger.error(f"Failed to create LangChain agent/executor: {e}")
        agent_executor = None
else:
     logger.warning("LangChain agent prerequisites not met (LLM or tools missing/failed). Agent not created.")


# --- New LangChain Agent Endpoint ---
@app.route('/api/agent/invoke', methods=['POST'])
def invoke_agent():
    if not request.is_json: return jsonify({"error": "Request must be JSON"}), 400
    if not agent_executor: return jsonify({"error": "Agent not initialized"}), 503 # Service unavailable

    data = request.get_json()
    user_input = data.get('input')
    # TODO: Add conversation history / user feedback handling here
    if not user_input: return jsonify({"error": "Missing 'input' field"}), 400

    logger.info(f"Invoking agent with input: {user_input[:100]}...") # Log first 100 chars
    try:
        # Invoke the agent - response structure depends on the agent type
        response = agent_executor.invoke({"input": user_input})
        logger.info(f"Agent raw response: {response}")
        output = response.get('output', 'Agent did not produce standard output.')
        # Optionally return intermediate steps for debugging/display
        # intermediate_steps = response.get('intermediate_steps', [])
        return jsonify({"response": output}) #, "steps": intermediate_steps})
    except Exception as e:
        logger.error(f"Error invoking agent: {e}", exc_info=True) # Log full traceback
        return jsonify({"error": "Agent invocation failed", "details": str(e)}), 500


# --- Main Execution ---
if __name__ == '__main__':
    # This block is less relevant when run via Flask/Gunicorn command in Docker.
    # The actual run command is handled by Docker/Compose.
    pass