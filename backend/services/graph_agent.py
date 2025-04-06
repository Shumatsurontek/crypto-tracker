import logging
from typing import Dict, List, Any, Optional, TypedDict, Annotated
from langchain_huggingface import HuggingFaceEndpoint
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_community.tools import DuckDuckGoSearchRun
from langchain.tools import BaseTool, StructuredTool
from utils.config import HUGGINGFACE_API_KEY
from utils.api_client import make_request
from utils.config import (
    CRYPTOPANIC_API_KEY, CRYPTOPANIC_API_URL,
    FMP_API_KEY, FMP_API_URL
)

# For future LangGraph integration
try:
    from langgraph.graph import StateGraph, END
    from langgraph.checkpoint import MemorySaver
    HAS_LANGGRAPH = True
except ImportError:
    HAS_LANGGRAPH = False
    
# Configure logger
logger = logging.getLogger(__name__)

class AgentState(TypedDict):
    """Type definition for agent state"""
    messages: List[Dict[str, Any]]
    tools_used: List[str]
    final_answer: Optional[str]
    
# Custom tools functions
def search_web(query: str) -> str:
    """Search the web for current information about crypto markets."""
    search = DuckDuckGoSearchRun()
    return search.run(query)

def get_crypto_news() -> str:
    """Get the latest cryptocurrency news headlines."""
    logger.info("Fetching crypto news...")
    if not CRYPTOPANIC_API_KEY:
        return "Error: Cryptopanic API key not configured."
    
    url = f"{CRYPTOPANIC_API_URL}/posts/"
    params = {'auth_token': CRYPTOPANIC_API_KEY, 'public': 'true', 'posts_per_page': 5 }
    
    try:
        data = make_request(url, params=params)
        if data and 'results' in data:
            titles = [a.get('title', 'No Title') for a in data['results']]
            return f"Found {len(titles)} articles: " + "; ".join(titles)
        return "No crypto news articles found."
    except Exception as e:
        logger.error(f"Crypto news fetch error: {e}")
        return f"Error fetching crypto news: {e}"

def get_market_index() -> str:
    """Get the current market index value and trend."""
    logger.info("Fetching market index...")
    if not FMP_API_KEY:
        return "Error: Financial Modeling Prep API key not configured."
    
    try:
        url = f"{FMP_API_URL}/quote/%5EDJI"
        params = {'apikey': FMP_API_KEY}
        data = make_request(url, params=params)
        
        if data and isinstance(data, list) and len(data) > 0:
            market_data = data[0]
            price = market_data.get("price", 0)
            change = market_data.get("change", 0)
            change_percent = market_data.get("changesPercentage", 0)
            
            trend = "up" if change > 0 else "down" if change < 0 else "unchanged"
            return f"Dow Jones is at {price:.2f}, {trend} {abs(change):.2f} points ({change_percent:.2f}%) today."
        else:
            return "Unable to fetch current market index data."
    except Exception as e:
        logger.error(f"Market index fetch error: {e}")
        return f"Error fetching market index: {e}"

# Create structured tools
search_web_tool = StructuredTool.from_function(
    func=search_web,
    name="search_web",
    description="Search the web for information about crypto markets."
)

crypto_news_tool = StructuredTool.from_function(
    func=get_crypto_news,
    name="get_crypto_news",
    description="Get the latest cryptocurrency news headlines."
)

market_index_tool = StructuredTool.from_function(
    func=get_market_index,
    name="get_market_index",
    description="Get the current market index value and trend."
)

# Tool collection
AGENT_TOOLS = [search_web_tool, crypto_news_tool, market_index_tool]

# LangGraph agent (placeholder for future implementation)
def create_agent_graph():
    """
    Initialize and return a LangGraph for crypto assistance
    
    Note: This is a placeholder for future implementation
    """
    if not HAS_LANGGRAPH:
        logger.warning("LangGraph is not installed - agent graph creation skipped")
        return None
    
    if not HUGGINGFACE_API_KEY:
        logger.error("Hugging Face API key not configured")
        return None
    
    try:
        # Initialize LLM
        llm = HuggingFaceEndpoint(
            repo_id="mistralai/Mistral-7B-Instruct-v0.2",
            huggingfacehub_api_token=HUGGINGFACE_API_KEY,
            max_new_tokens=512
        )
        
        # Define nodes for StateGraph (placeholder)
        # Future implementation with proper LangGraph nodes
        
        logger.info("LangGraph agent created successfully")
        return {
            "status": "placeholder",
            "message": "This is a placeholder for future LangGraph implementation"
        }
    
    except Exception as e:
        logger.error(f"Error creating LangGraph agent: {e}")
        return None 