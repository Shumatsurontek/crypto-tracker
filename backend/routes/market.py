from flask import Blueprint, jsonify
import logging
from utils.api_client import make_request
from utils.config import FMP_API_KEY, FMP_API_URL

# Configure logger
logger = logging.getLogger(__name__)

# Create blueprint
market_routes = Blueprint('market', __name__)

@market_routes.route('/fear-greed', methods=['GET'])
def get_fear_greed():
    """Get the latest Fear & Greed index value"""
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

@market_routes.route('/index', methods=['GET'])
def get_market_index():
    """Get latest market index data (Apple stock as indicator)"""
    # Change from ^DJI (index) to AAPL (stock) which works with the free plan
    symbol = "AAPL"  
    logger.info(f"Fetching {symbol} data as market indicator...")
    
    if not FMP_API_KEY:
        logger.error("FMP API key not configured.")
        return jsonify({"error": "API key for market index not configured"}), 500
    
    url = f"{FMP_API_URL}/quote/{symbol}"
    params = {'apikey': FMP_API_KEY}
    
    try:
        data = make_request(url, params=params)
        if data and isinstance(data, list) and len(data) > 0:
            market_data = data[0]
            formatted_data = {
                "symbol": market_data.get("symbol", symbol),
                "name": market_data.get("name", "Apple Inc."),
                "price": market_data.get("price", 0),
                "change": market_data.get("change", 0),
                "change_percent": market_data.get("changesPercentage", 0),
                "day_low": market_data.get("dayLow", 0),
                "day_high": market_data.get("dayHigh", 0),
                "year_high": market_data.get("yearHigh", 0),
                "year_low": market_data.get("yearLow", 0),
                "market_cap": market_data.get("marketCap", 0),
                "last_updated": market_data.get("timestamp", 0),
            }
            logger.info(f"{symbol} data fetched successfully.")
            return jsonify(formatted_data)
        else:
            logger.error(f"FMP API returned unexpected data format: {data}")
            return jsonify({"error": "Invalid data format from FMP API"}), 500
    except Exception as e:
        logger.error(f"Error processing {symbol} data: {e}")
        return jsonify({"error": f"Failed to fetch market data", "details": str(e)}), 500 