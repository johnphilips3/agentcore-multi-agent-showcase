"""
LangSmith Evaluation Package for Farm Assistant Agent

This package provides async evaluation capabilities for testing and monitoring
the performance of the Farm Assistant Agent using LangSmith.
"""

from .langsmith_evaluation import FarmAssistantEvaluator, FARM_AGENT_AVAILABLE
from .langsmith_config import LangSmithConfig, EVALUATION_CRITERIA, get_sample_dataset

__version__ = "1.0.0"
__all__ = [
    "FarmAssistantEvaluator",
    "FARM_AGENT_AVAILABLE", 
    "LangSmithConfig",
    "EVALUATION_CRITERIA",
    "get_sample_dataset"
]