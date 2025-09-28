"""
Middleware for integrating Bedrock Guardrails with agent interactions.
"""

import logging
from typing import Any, Callable, Dict, Optional, Union
from functools import wraps

from .guardrails_client import GuardrailsClient
from .guardrails_config import GuardrailsConfig


logger = logging.getLogger(__name__)


class GuardrailsMiddleware:
    """Middleware for applying guardrails to agent interactions."""
    
    def __init__(self, config: Optional[GuardrailsConfig] = None):
        """Initialize the middleware.
        
        Args:
            config: Guardrails configuration. If None, loads from environment.
        """
        if config is None:
            config = GuardrailsConfig.from_environment()
        
        self.config = config
        self.client = GuardrailsClient(config)
        self.enabled = True
        
        logger.info("Guardrails middleware initialized")
    
    def enable(self):
        """Enable guardrails middleware."""
        self.enabled = True
        logger.info("Guardrails middleware enabled")
    
    def disable(self):
        """Disable guardrails middleware."""
        self.enabled = False
        logger.info("Guardrails middleware disabled")
    
    def filter_input(self, content: Union[str, Dict[str, Any]]) -> Union[str, Dict[str, Any]]:
        """Filter input content through guardrails.
        
        Args:
            content: Input content to filter
            
        Returns:
            Filtered content or original content if filtering is disabled
        """
        if not self.enabled or not self.config.enable_input_filtering:
            return content
        
        try:
            # Extract text content for filtering
            if isinstance(content, str):
                text_content = content
            elif isinstance(content, dict):
                # Handle various dictionary structures
                if 'query' in content:
                    text_content = content['query']
                elif 'text' in content:
                    text_content = content['text']
                elif 'message' in content:
                    text_content = content['message']
                else:
                    # If it's a dict but doesn't have expected keys, convert to string
                    text_content = str(content)
            elif hasattr(content, '__str__'):
                # Handle other types that can be converted to string
                text_content = str(content)
            else:
                logger.warning(f"Unsupported content type for input filtering: {type(content)}")
                return content
            
            # Check if content is safe
            if not self.client.is_content_safe(text_content, source="INPUT"):
                logger.warning("Input content blocked by guardrails")
                
                # Get filtered content
                filtered_content = self.client.get_filtered_content(text_content, source="INPUT")
                
                if isinstance(content, str):
                    return filtered_content[0] if filtered_content else ""
                elif isinstance(content, dict):
                    content['query'] = filtered_content[0] if filtered_content else ""
                    return content
            
            return content
            
        except Exception as e:
            logger.error(f"Error filtering input content: {e}")
            return content
    
    def filter_output(self, content: Union[str, Dict[str, Any]]) -> Union[str, Dict[str, Any]]:
        """Filter output content through guardrails.
        
        Args:
            content: Output content to filter
            
        Returns:
            Filtered content or original content if filtering is disabled
        """
        if not self.enabled or not self.config.enable_output_filtering:
            return content
        
        try:
            # Extract text content for filtering
            if isinstance(content, str):
                text_content = content
            elif isinstance(content, dict):
                # Handle various dictionary structures
                if 'response' in content:
                    text_content = content['response']
                elif 'text' in content:
                    text_content = content['text']
                elif 'message' in content:
                    text_content = content['message']
                else:
                    # If it's a dict but doesn't have expected keys, convert to string
                    text_content = str(content)
            elif hasattr(content, '__str__'):
                # Handle other types that can be converted to string
                text_content = str(content)
            else:
                logger.warning(f"Unsupported content type for output filtering: {type(content)}")
                return content
            
            # Check if content is safe
            if not self.client.is_content_safe(text_content, source="OUTPUT"):
                logger.warning("Output content blocked by guardrails")
                
                # Get filtered content
                filtered_content = self.client.get_filtered_content(text_content, source="OUTPUT")
                
                if isinstance(content, str):
                    return filtered_content[0] if filtered_content else "Content filtered by guardrails."
                elif isinstance(content, dict):
                    content['response'] = filtered_content[0] if filtered_content else "Content filtered by guardrails."
                    return content
            
            return content
            
        except Exception as e:
            logger.error(f"Error filtering output content: {e}")
            return content
    
    def get_content_assessment(self, content: str, source: str = "INPUT") -> Dict[str, Any]:
        """Get detailed assessment of content.
        
        Args:
            content: Content to assess
            source: Source type - "INPUT" or "OUTPUT"
            
        Returns:
            Assessment details
        """
        if not self.enabled:
            return {'action': 'DISABLED', 'assessments': []}
        
        return self.client.get_assessment_details(content, source)


def with_guardrails(
    config: Optional[GuardrailsConfig] = None,
    filter_input: bool = True,
    filter_output: bool = True
):
    """Decorator to apply guardrails to a function.
    
    Args:
        config: Guardrails configuration
        filter_input: Whether to filter input parameters
        filter_output: Whether to filter output
        
    Returns:
        Decorated function
    """
    def decorator(func: Callable) -> Callable:
        middleware = GuardrailsMiddleware(config)
        
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Filter input if enabled
            if filter_input:
                # Filter positional arguments
                if args:
                    filtered_args = []
                    for arg in args:
                        # Only filter string arguments and dictionaries that likely contain text
                        if isinstance(arg, (str, dict)) or hasattr(arg, '__str__'):
                            filtered_args.append(middleware.filter_input(arg))
                        else:
                            filtered_args.append(arg)
                    args = tuple(filtered_args)
                
                # Filter keyword arguments
                if kwargs:
                    filtered_kwargs = {}
                    for key, value in kwargs.items():
                        # Only filter string values and dictionaries that likely contain text
                        if isinstance(value, (str, dict)) or hasattr(value, '__str__'):
                            filtered_kwargs[key] = middleware.filter_input(value)
                        else:
                            filtered_kwargs[key] = value
                    kwargs = filtered_kwargs
            
            # Call the original function
            result = func(*args, **kwargs)
            
            # Filter output if enabled
            if filter_output and result is not None:
                result = middleware.filter_output(result)
            
            return result
        
        return wrapper
    return decorator