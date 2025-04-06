import requests
import logging
import time
from flask import jsonify

logger = logging.getLogger(__name__)

def make_request(url, params=None, headers=None, method='GET', json_data=None, timeout=30):
    """
    Centralized request handler with error handling, logging, and metrics
    
    Args:
        url: The API endpoint URL
        params: Optional query parameters
        headers: Optional HTTP headers
        method: HTTP method (GET, POST, etc.)
        json_data: Optional JSON data for POST requests
        timeout: Request timeout in seconds (default 30s, was 10s)
        
    Returns:
        Parsed JSON response or raises an exception
    """
    start_time = time.time()
    logger.info(f"Making {method} request to {url}")
    
    try:
        if method.upper() == 'GET':
            response = requests.get(url, params=params, headers=headers, timeout=timeout)
        elif method.upper() == 'POST':
            response = requests.post(url, params=params, headers=headers, json=json_data, timeout=timeout)
        else:
            logger.error(f"Unsupported method: {method}")
            raise ValueError(f"Unsupported method: {method}")
        
        # Log request time
        elapsed_ms = (time.time() - start_time) * 1000
        logger.info(f"Request to {url} completed in {elapsed_ms:.2f}ms with status {response.status_code}")
        
        # Raise for HTTP errors
        response.raise_for_status()
        
        # Return parsed JSON data
        return response.json()
        
    except requests.exceptions.HTTPError as http_err:
        elapsed_ms = (time.time() - start_time) * 1000
        logger.error(f"HTTP error occurred: {http_err} ({elapsed_ms:.2f}ms)")
        raise
    except requests.exceptions.ConnectionError as conn_err:
        logger.error(f"Connection error occurred: {conn_err}")
        raise
    except requests.exceptions.Timeout as timeout_err:
        logger.error(f"Timeout error occurred: {timeout_err}")
        raise
    except requests.exceptions.RequestException as req_err:
        logger.error(f"Request error occurred: {req_err}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error in make_request: {e}")
        raise 