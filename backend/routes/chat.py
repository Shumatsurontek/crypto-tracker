from flask import Blueprint, jsonify, request
import logging
import time
from utils.config import HUGGINGFACE_API_KEY, CHAT_MODEL, CHAT_MODELS
from langchain_huggingface import HuggingFaceEndpoint
from typing import Annotated, List, TypedDict, Dict, Any
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langchain_community.tools import DuckDuckGoSearchRun
from langgraph.graph import END, StateGraph, START
from langgraph.graph.message import add_messages
from utils.api_client import make_request
from utils.config import (
    CRYPTOPANIC_API_KEY, CRYPTOPANIC_API_URL,
    FMP_API_KEY, FMP_API_URL
)

# Configure logger
logger = logging.getLogger(__name__)

# Create blueprint
chat_routes = Blueprint('chat', __name__)

# Current model cache
current_model = {
    "id": CHAT_MODEL,
    "instance": None
}

# --- Tool Definitions ---
@tool
def search_web(query: str) -> str:
    """Search the web for current information about crypto markets."""
    search = DuckDuckGoSearchRun()
    return search.run(query)

@tool
def get_latest_crypto_news_headlines() -> str:
    """Get the latest cryptocurrency news headlines."""
    logger.info("[Tool] Fetching crypto news...")
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
        logger.error(f"[Tool] Crypto news fetch error: {e}")
        return f"Error fetching crypto news: {e}"

@tool
def get_current_market_index() -> str:
    """Get the current market index value and trend."""
    logger.info("[Tool] Fetching market index...")
    if not FMP_API_KEY:
        return "Error: Financial Modeling Prep API key not configured."
    
    try:
        # Use AAPL instead of ^DJI since we're on free plan
        url = f"{FMP_API_URL}/quote/AAPL"
        params = {'apikey': FMP_API_KEY}
        data = make_request(url, params=params)
        
        if data and isinstance(data, list) and len(data) > 0:
            market_data = data[0]
            price = market_data.get("price", 0)
            change = market_data.get("change", 0)
            change_percent = market_data.get("changesPercentage", 0)
            
            trend = "up" if change > 0 else "down" if change < 0 else "unchanged"
            return f"Apple stock is at ${price:.2f}, {trend} ${abs(change):.2f} ({change_percent:.2f}%) today."
        else:
            return "Unable to fetch current market data."
    except Exception as e:
        logger.error(f"[Tool] Market data fetch error: {e}")
        return f"Error fetching market data: {e}"

tools = [search_web, get_latest_crypto_news_headlines, get_current_market_index]

# --- LangGraph Implementation ---
class State(TypedDict):
    """The state of our graph."""
    messages: Annotated[List, add_messages]

def get_model_instance(model_id: str = None) -> HuggingFaceEndpoint:
    """Get an instance of the specified model, or use the current one if no ID is provided"""
    global current_model
    
    # If no model_id specified, use the current model
    if not model_id:
        model_id = current_model["id"]
    
    # If requesting the already instantiated model, return it
    if model_id == current_model["id"] and current_model["instance"]:
        return current_model["instance"]
    
    # Create new model instance with appropriate configuration
    logger.info(f"Initializing new chat model: {model_id}")
    
    # Get model-specific configuration
    task_type = "text-generation"  # Default task type
    
    # Handle model-specific settings
    if "t5" in model_id.lower():
        task_type = "text2text-generation"
    elif "falcon" in model_id.lower():
        task_type = "text-generation"
    elif "llama" in model_id.lower():
        task_type = "text-generation"
    elif "phi" in model_id.lower():
        task_type = "text-generation"
    elif "zephyr" in model_id.lower():
        task_type = "text-generation"
    elif "bart" in model_id.lower():
        task_type = "text2text-generation"
    elif "mistral" in model_id.lower():
        task_type = "text-generation"
    else:
        # Try to determine task type based on model architecture
        logger.info(f"Using default task type for {model_id}")
        
    logger.info(f"Using task type: {task_type} for model: {model_id}")
    
    # Create model instance
    model = HuggingFaceEndpoint(
        repo_id=model_id,
        huggingfacehub_api_token=HUGGINGFACE_API_KEY,
        max_new_tokens=250,  # Use 250 as maximum for all models to prevent API errors
        task=task_type,
        temperature=0.7,
        top_p=0.95
    )
    
    # Update current model cache
    current_model["id"] = model_id
    current_model["instance"] = model
    
    return model

def create_graph(model_id: str = None):
    """Create a new LangGraph with specified LLM model."""
    # Initialize the state graph
    graph_builder = StateGraph(State)
    
    # Initialize LLM
    llm = get_model_instance(model_id)
    
    # Define chatbot node - processes messages and generates responses
    def chatbot(state):
        messages = state["messages"]
        try:
            response = llm.invoke(messages)
            return {"messages": [response]}
        except Exception as e:
            logger.error(f"Error invoking LLM: {e}")
            # Fallback to simple response
            return {"messages": [AIMessage(content=f"I apologize, but I'm having trouble processing your request right now. Please try again later.")]}
    
    # Define tools node - handles tool execution
    def tools_executor(state):
        """Execute tools if the AI wants to use them."""
        messages = state["messages"]
        last_message = messages[-1]
        
        # If the message has tool calls
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            tool_results = []
            for tool_call in last_message.tool_calls:
                tool_name = tool_call.name
                tool_args = tool_call.args if hasattr(tool_call, "args") else {}
                
                # Find the matching tool
                matching_tool = None
                for tool_fn in tools:
                    if tool_fn.name == tool_name:
                        matching_tool = tool_fn
                        break
                
                if matching_tool:
                    try:
                        tool_result = matching_tool.invoke(tool_args)
                        tool_results.append(
                            ToolMessage(
                                content=str(tool_result),
                                name=tool_name
                            )
                        )
                    except Exception as e:
                        logger.error(f"Error executing tool {tool_name}: {e}")
                        tool_results.append(
                            ToolMessage(
                                content=f"Error executing {tool_name}: {str(e)}",
                                name=tool_name
                            )
                        )
                else:
                    # Tool not found
                    tool_results.append(
                        ToolMessage(
                            content=f"Tool '{tool_name}' not found.",
                            name=tool_name
                        )
                    )
            
            return {"messages": tool_results}
        
        # If no tool calls, return empty message list (no update)
        return {"messages": []}
    
    # Define conditional routing
    def should_use_tools(state):
        """Determine if we should route to tools."""
        messages = state["messages"]
        if not messages:
            return END
            
        last_message = messages[-1]
        
        # If the AI message has tool calls, route to tools
        if isinstance(last_message, AIMessage) and hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "tools"
        
        # Otherwise we're done
        return END
    
    # Add nodes to graph
    graph_builder.add_node("chatbot", chatbot)
    graph_builder.add_node("tools", tools_executor)
    
    # Define edges for the graph
    graph_builder.add_edge(START, "chatbot")
    graph_builder.add_conditional_edges("chatbot", should_use_tools)
    graph_builder.add_edge("tools", "chatbot")
    
    # Compile the graph
    return graph_builder.compile()

@chat_routes.route('/models', methods=['GET'])
def get_chat_models():
    """Get available chat models"""
    try:
        return jsonify({"models": CHAT_MODELS, "current": current_model["id"]})
    except Exception as e:
        logger.error(f"Error retrieving chat models: {e}")
        return jsonify({"error": "Failed to retrieve chat models"}), 500

@chat_routes.route('/models/select', methods=['POST'])
def select_chat_model():
    """Select chat model to use"""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    
    data = request.get_json()
    model_id = data.get('model_id')
    
    if not model_id:
        return jsonify({"error": "Missing 'model_id' field"}), 400
    
    # Validate model ID is in available models
    valid_model = False
    for model in CHAT_MODELS:
        if model["id"] == model_id:
            valid_model = True
            break
    
    if not valid_model:
        return jsonify({"error": f"Invalid model_id: {model_id}"}), 400
    
    try:
        # Update the current model
        global current_model
        current_model["id"] = model_id
        current_model["instance"] = None  # Clear instance to force recreation
        
        # Initialize the model to validate it works
        get_model_instance(model_id)
        
        return jsonify({"success": True, "model_id": model_id})
    except Exception as e:
        logger.error(f"Error selecting chat model: {e}")
        return jsonify({"error": f"Failed to select chat model: {str(e)}"}), 500

@chat_routes.route('/ask', methods=['POST'])
def ask_question():
    """Process a question using LangGraph"""
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400
    
    data = request.get_json()
    question = data.get('question')
    model_id = data.get('model_id')  # Optional - use specified model or default if not provided
    
    if not question:
        return jsonify({"error": "Missing 'question' field"}), 400
    
    logger.info(f"Received chat question: {question}" + (f" using model: {model_id}" if model_id else ""))
    
    if not HUGGINGFACE_API_KEY:
        logger.error("Hugging Face API key not configured")
        return jsonify({"error": "Hugging Face API key not configured"}), 500
    
    start_time = time.time()
    
    try:
        # Validate model_id if provided
        if model_id:
            valid_model = False
            for model in CHAT_MODELS:
                if model["id"] == model_id:
                    valid_model = True
                    break
                    
            if not valid_model:
                logger.warning(f"Invalid model_id requested: {model_id}, using default")
                model_id = CHAT_MODEL
        
        # Create a graph with the selected model
        graph = create_graph(model_id)
        
        # Create initial state with system message and user question
        initial_state = {
            "messages": [
                SystemMessage(content="You are a helpful assistant that specializes in cryptocurrency and financial markets. Use the available tools when needed to provide accurate and up-to-date information."),
                HumanMessage(content=question)
            ]
        }
        
        # Execute the graph
        result = graph.invoke(initial_state)
        execution_time = time.time() - start_time
        
        logger.info(f"Chat response generated in {execution_time:.2f}s")
        
        # Extract the AI's final response
        messages = result["messages"]
        for message in reversed(messages):
            if isinstance(message, AIMessage):
                response = message.content
                break
        else:
            response = "No response generated."
        
        # Update metrics in the llm module
        try:
            from routes.llm import update_metrics
            update_metrics("chat", execution_time)
        except ImportError:
            # If metrics function is not available, just log it
            logger.info("Metrics tracking not available for chat")
        
        result = {
            "answer": response,
            "execution_time": f"{execution_time:.2f}s",
            "model": current_model["id"]
        }
        
        return jsonify(result)
    
    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(f"Error in chat agent: {e}")
        
        # Create a user-friendly error message
        error_msg = str(e)
        user_error = "I'm having trouble processing your request."
        
        if "API key" in error_msg.lower():
            user_error = "The API key for accessing the language model is invalid or missing."
        elif "rate limit" in error_msg.lower():
            user_error = "The service is currently experiencing high demand. Please try again later."
        elif "task" in error_msg.lower() and "support" in error_msg.lower():
            user_error = "There was an issue with the selected model. The system will fall back to a recommended model."
            # Try to use a different model
            current_model_id = current_model["id"]  # Save current
            try:
                current_model["id"] = "meta-llama/Meta-Llama-3-8B-Instruct"  # Default fallback to Llama 3
                current_model["instance"] = None
            except Exception as model_err:
                logger.error(f"Error while setting fallback model: {model_err}")
                # Restore original
                current_model["id"] = current_model_id
        
        # Update error metrics
        try:
            from routes.llm import update_metrics
            update_metrics("chat", execution_time, error=True)
        except ImportError:
            logger.info("Error metrics tracking not available for chat")
            
        return jsonify({
            "error": f"Failed to process question: {str(e)}",
            "answer": f"{user_error} Technical details: {error_msg[:100]}...",
            "execution_time": f"{execution_time:.2f}s",
            "model": current_model["id"]
        }), 500