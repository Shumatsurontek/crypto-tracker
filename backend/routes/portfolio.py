from flask import Blueprint, jsonify
import logging
from utils.api_client import make_request
from utils.config import ETHERSCAN_API_KEY, ETHERSCAN_API_URL, COINGECKO_API_URL

# Configure logger
logger = logging.getLogger(__name__)

# Create blueprint
portfolio_routes = Blueprint('portfolio', __name__)

@portfolio_routes.route('/<address>', methods=['GET'])
def get_portfolio(address):
    """Get portfolio data for the specified Ethereum address"""
    if not address or not address.startswith('0x'):
        return jsonify({"error": "Invalid Ethereum address format"}), 400
    
    logger.info(f"Fetching portfolio for address: {address}")
    
    if not ETHERSCAN_API_KEY:
        logger.error("Etherscan API key not configured.")
        return jsonify({"error": "API key for Etherscan not configured"}), 500
    
    try:
        # 1. Fetch ETH balance
        eth_balance_url = f"{ETHERSCAN_API_URL}"
        eth_params = {
            'module': 'account',
            'action': 'balance',
            'address': address,
            'tag': 'latest',
            'apikey': ETHERSCAN_API_KEY
        }
        
        eth_data = make_request(eth_balance_url, params=eth_params)
        if eth_data.get('status') != '1':
            logger.error(f"Etherscan API error: {eth_data.get('message')}")
            return jsonify({"error": f"Etherscan API error: {eth_data.get('message')}"}), 500
        
        eth_balance_wei = int(eth_data.get('result', '0'))
        eth_balance = eth_balance_wei / 1e18  # Convert wei to ETH
        
        # 2. Fetch token balances
        token_balance_url = f"{ETHERSCAN_API_URL}"
        token_params = {
            'module': 'account',
            'action': 'tokentx',
            'address': address,
            'page': 1,
            'offset': 100,
            'sort': 'desc',
            'apikey': ETHERSCAN_API_KEY
        }
        
        token_data = make_request(token_balance_url, params=token_params)
        if token_data.get('status') != '1' and token_data.get('message') != 'No transactions found':
            logger.error(f"Etherscan token API error: {token_data.get('message')}")
            return jsonify({"error": f"Etherscan token API error: {token_data.get('message')}"}), 500
        
        # Fetch token transfers and construct portfolio
        tokens = {}
        if 'result' in token_data and isinstance(token_data['result'], list):
            for tx in token_data['result']:
                token_address = tx.get('contractAddress', '').lower()
                token_symbol = tx.get('tokenSymbol', 'Unknown')
                token_name = tx.get('tokenName', 'Unknown Token')
                token_decimals = int(tx.get('tokenDecimal', '18'))
                
                if token_address not in tokens:
                    tokens[token_address] = {
                        'address': token_address,
                        'symbol': token_symbol,
                        'name': token_name,
                        'balance': 0,
                        'value_usd': 0
                    }
        
        # 3. Get ETH price from CoinGecko
        eth_price_url = f"{COINGECKO_API_URL}/simple/price"
        eth_price_params = {
            'ids': 'ethereum',
            'vs_currencies': 'usd'
        }
        
        eth_price_data = make_request(eth_price_url, params=eth_price_params)
        eth_price_usd = eth_price_data.get('ethereum', {}).get('usd', 0)
        eth_value_usd = eth_balance * eth_price_usd
        
        # Construct final portfolio data
        assets = [{'symbol': 'ETH', 'name': 'Ethereum', 'balance': eth_balance, 'value_usd': eth_value_usd}]
        for token in tokens.values():
            if token['balance'] > 0:
                assets.append(token)
        
        total_value_usd = sum(asset['value_usd'] for asset in assets)
        
        portfolio_data = {
            'address': address,
            'total_value_usd': total_value_usd,
            'assets': assets,
            'eth_balance': eth_balance,
            'eth_value_usd': eth_value_usd,
        }
        
        logger.info(f"Portfolio data fetched successfully for {address}")
        return jsonify(portfolio_data)
    
    except Exception as e:
        logger.error(f"Error processing portfolio data: {e}")
        return jsonify({"error": "Failed to fetch portfolio data", "details": str(e)}), 500 