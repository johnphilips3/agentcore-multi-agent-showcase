"""
LangSmith Configuration for Farm Assistant Evaluation

This module contains configuration settings and helper functions for LangSmith evaluation.
"""

import os
from typing import Dict, Any, Optional

class LangSmithConfig:
    """Configuration class for LangSmith evaluation settings"""
    
    def __init__(self):
        self.api_key = os.getenv("LANGSMITH_API_KEY")
        self.project_name = "alpaca-farm-assistant"
        self.dataset_name = "alpaca_farm_evaluation_basic"
        self.experiment_prefix = "farm_assistant_eval"
        
    def validate_config(self) -> bool:
        """Validate that required configuration is present"""
        if not self.api_key:
            print("❌ LANGSMITH_API_KEY not found in environment variables")
            return False
        return True
    
    def get_environment_setup_instructions(self) -> str:
        """Get instructions for setting up the environment"""
        return """
🔧 LangSmith Setup Instructions:

1. Install LangSmith:
   pip install langsmith

2. Get your API key from LangSmith (https://smith.langchain.com/)

3. Set your API key as an environment variable:
   export LANGSMITH_API_KEY='your-api-key-here'

4. Optional: Set your project name:
   export LANGCHAIN_PROJECT='alpaca-farm-assistant'

5. Run the evaluation:
   python langsmith_evaluation.py
"""

# Evaluation criteria definitions
EVALUATION_CRITERIA = {
    "response_quality": {
        "description": "Overall quality and helpfulness of the response",
        "scale": "0-1 (0=poor, 1=excellent)"
    },
    "tool_routing": {
        "description": "Correct routing to appropriate specialized agent/tool",
        "scale": "0-1 (0=wrong tool, 1=correct tool)"
    },
    "response_completeness": {
        "description": "Response addresses the full query",
        "scale": "0-1 (0=incomplete, 1=complete)"
    },
    "accuracy": {
        "description": "Factual accuracy of the response",
        "scale": "0-1 (0=inaccurate, 1=accurate)"
    }
}

# Sample test cases for different agent types
SAMPLE_TEST_CASES = {
    "alpaca_management": [
        "How many alpacas do we have?",
        "Add a new alpaca named Snowball",
        "Show health records for alpaca ALP-001",
        "Update breeding information for female alpacas",
        "What's the average weight of our herd?"
    ],
    "math_calculations": [
        "Calculate feed cost for 25 alpacas at $4.50 per day for 30 days",
        "What's 15% of 240?",
        "If we sell fleece at $12 per pound and have 45 pounds, what's our revenue?",
        "Calculate the area of a rectangular pasture 150ft by 200ft"
    ],
    "language_translation": [
        "Translate 'alpaca farm' to Spanish",
        "How do you say 'healthy animals' in French?",
        "Translate this to German: 'The alpacas are in the pasture'"
    ],
    "general_queries": [
        "What's the weather like?",
        "Tell me about renewable energy",
        "What are the benefits of organic farming?",
        "Explain climate change"
    ]
}

def get_sample_dataset() -> list:
    """Generate a sample dataset for evaluation"""
    dataset = []
    
    for category, queries in SAMPLE_TEST_CASES.items():
        for query in queries:
            # Determine expected tool based on category
            if category == "alpaca_management":
                expected_tool = "alpaca_farm_assistant"
            elif category == "math_calculations":
                expected_tool = "math_assistant"
            elif category == "language_translation":
                expected_tool = "language_assistant"
            else:
                expected_tool = "general_assistant"
            
            dataset.append({
                "inputs": {"prompt": query},
                "outputs": {
                    "category": category,
                    "expected_tool": expected_tool
                }
            })
    
    return dataset