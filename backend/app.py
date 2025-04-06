import logging
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
import os
import time
import collections

# Import route blueprints
from routes.market import market_routes
from routes.news import news_routes
from routes.portfolio import portfolio_routes
from routes.llm import llm_routes
from routes.chat import chat_routes

# Import configuration
from utils.config import CORS_ORIGINS

# --- Basic Setup ---
load_dotenv()
app = Flask(__name__)

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- In-memory Log Storage ---
log_buffer = collections.deque(maxlen=100)  # Store last 100 logs

# Custom log handler to store logs in memory
class MemoryLogHandler(logging.Handler):
    def emit(self, record):
        log_entry = {
            "timestamp": int(time.time()),
            "level": record.levelno,
            "level_name": record.levelname,
            "name": record.name,
            "message": self.format(record)
        }
        log_buffer.append(log_entry)

# Add memory handler to root logger
memory_handler = MemoryLogHandler()
memory_handler.setLevel(logging.INFO)
logging.getLogger().addHandler(memory_handler)

# --- Global Metrics ---
metrics = {
    "sentiment": {
        "calls": 0,
        "errors": 0,
        "average_time": 0
    },
    "summarization": {
        "calls": 0,
        "errors": 0,
        "average_time": 0
    },
    "chat": {
        "calls": 0,
        "errors": 0,
        "average_time": 0
    },
    "last_updated": int(time.time())
}

# --- CORS Configuration ---
CORS(app, resources={r"/api/*": {"origins": CORS_ORIGINS}})

# --- Register Blueprints ---
app.register_blueprint(market_routes, url_prefix='/api/market')
app.register_blueprint(news_routes, url_prefix='/api/news')
app.register_blueprint(portfolio_routes, url_prefix='/api/portfolio')
app.register_blueprint(llm_routes, url_prefix='/api/llm')
app.register_blueprint(chat_routes, url_prefix='/api/chat')

# --- Root Endpoint ---
@app.route('/')
def index():
    """Root endpoint"""
    logger.info("Root endpoint accessed")
    return jsonify({"message": "Welcome to the Crypto Tracker Python Backend!"})

# --- Metrics Endpoint ---
@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    """Get application metrics"""
    try:
        from routes.llm import metrics as llm_metrics
        # Merge metrics from llm.py if available
        return jsonify(llm_metrics)
    except ImportError:
        # Fallback to global metrics
        return jsonify(metrics)

# --- Logs Endpoint ---
@app.route('/api/logs', methods=['GET'])
def get_logs():
    """Get recent application logs"""
    # Convert to list for JSON serialization
    return jsonify({"logs": list(log_buffer)})

# --- Error Handlers ---
@app.errorhandler(404)
def not_found(error):
    logger.info(f"404 error: {request.path}")
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def server_error(error):
    logger.error(f"500 error: {error}")
    return jsonify({"error": "Internal server error"}), 500

# --- Main Execution ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3001))
    app.run(host='0.0.0.0', port=port)