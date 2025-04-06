import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# API Keys
ETHERSCAN_API_KEY = os.getenv('ETHERSCAN_API_KEY', '')
HUGGINGFACE_API_KEY = os.getenv('HUGGINGFACE_API_KEY', '')
CRYPTOPANIC_API_KEY = os.getenv('CRYPTOPANIC_API_KEY', '')
FMP_API_KEY = os.getenv('FMP_API_KEY', '')
NEWSAPI_API_KEY = os.getenv('NEWSAPI_API_KEY', '')

# API URLs
COINGECKO_API_URL = 'https://api.coingecko.com/api/v3'
ETHERSCAN_API_URL = 'https://api.etherscan.io/api'
HUGGINGFACE_INFERENCE_API_URL = "https://api-inference.huggingface.co/models/"
CRYPTOPANIC_API_URL = 'https://cryptopanic.com/api/v1'
FMP_API_URL = 'https://financialmodelingprep.com/api/v3'
NEWSAPI_URL = 'https://newsapi.org/v2'

# Default Models
SUMMARIZATION_MODEL = os.getenv('SUMMARIZATION_MODEL', "facebook/bart-large-cnn")
SENTIMENT_MODEL = os.getenv('SENTIMENT_MODEL', "distilbert-base-uncased-finetuned-sst-2-english")
CHAT_MODEL = os.getenv('CHAT_MODEL', "meta-llama/Meta-Llama-3-8B-Instruct")

# Available Models
AVAILABLE_MODELS = {
    "summarization": [
        {"id": "facebook/bart-large-cnn", "name": "BART Large CNN (Default)"},
        {"id": "google/pegasus-xsum", "name": "PEGASUS XSUM"},
        {"id": "sshleifer/distilbart-cnn-12-6", "name": "DistilBART CNN"},
    ],
    "sentiment": [
        {"id": "distilbert-base-uncased-finetuned-sst-2-english", "name": "DistilBERT SST-2 (Default)"},
        {"id": "cardiffnlp/twitter-roberta-base-sentiment-latest", "name": "RoBERTa Twitter"},
        {"id": "finiteautomata/bertweet-base-sentiment-analysis", "name": "BERTweet Base"},
    ],
    "chat": [
        {"id": "meta-llama/Meta-Llama-3-8B-Instruct", "name": "Llama 3 8B (Recommended)"},
        {"id": "microsoft/phi-2", "name": "Phi-2"},
        {"id": "tiiuae/falcon-7b-instruct", "name": "Falcon 7B Instruct"},
        {"id": "HuggingFaceH4/zephyr-7b-beta", "name": "Zephyr 7B"},
        {"id": "google/flan-t5-base", "name": "Flan-T5 Base"},
    ]
}

# Lists of models (added for compatibility with llm.py)
SUMMARIZATION_MODELS = AVAILABLE_MODELS["summarization"]
SENTIMENT_MODELS = AVAILABLE_MODELS["sentiment"]
CHAT_MODELS = AVAILABLE_MODELS["chat"]

# Metrics Store
METRICS = {
    "summarization": {"model": SUMMARIZATION_MODEL, "calls": 0, "failures": 0, "success": 0, "total_latency_ms": 0},
    "sentiment": {"model": SENTIMENT_MODEL, "calls": 0, "failures": 0, "success": 0, "total_latency_ms": 0},
    "chat": {"model": CHAT_MODEL, "calls": 0, "failures": 0, "success": 0, "total_latency_ms": 0},
    "tool_usage": {}
}

# Logging
MAX_LOGS = 100
LOGS_STORE = []

# CORS Configuration 
CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"] 