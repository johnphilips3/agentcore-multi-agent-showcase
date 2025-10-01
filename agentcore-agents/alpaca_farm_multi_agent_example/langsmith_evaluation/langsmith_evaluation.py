#!/usr/bin/env python3
"""
Async LangSmith Evaluation Setup for Farm Assistant Agent

This module provides an async evaluation framework using LangSmith to test
the farm_assistant agent with various alpaca farm management scenarios.

Supports both local agent execution and remote AgentCore runtime endpoints.
"""

import os
import asyncio
from typing import List, Dict, Any, AsyncGenerator
from langsmith import Client
from langsmith.evaluation import aevaluate
from langsmith.schemas import Run, Example
import json

# Import configuration and remote client
from runtime_config import RuntimeConfig
from remote_client import AgentCoreRemoteClient

# Import your farm assistant from parent directory
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from farm_assistant import farm_agent, strands_agent_bedrock
    FARM_AGENT_AVAILABLE = True
    print("✅ Farm assistant agent imported successfully")
except ImportError as e:
    print(f"ℹ️  Could not import farm_assistant ({str(e)}). Using mock agent for testing.")
    FARM_AGENT_AVAILABLE = False
    farm_agent = None
    strands_agent_bedrock = None

class FarmAssistantEvaluator:
    """Simple evaluator for the farm assistant agent"""
    
    def __init__(self, langsmith_api_key: str = None, runtime_config: RuntimeConfig = None):
        """
        Initialize the evaluator
        
        Args:
            langsmith_api_key: LangSmith API key (can also be set via LANGSMITH_API_KEY env var)
            runtime_config: Runtime configuration for local vs remote execution
        """
        if langsmith_api_key:
            os.environ["LANGSMITH_API_KEY"] = langsmith_api_key
        
        self.client = Client()
        self.dataset_name = "alpaca_farm_evaluation_basic"
        
        # Initialize runtime configuration
        self.runtime_config = runtime_config or RuntimeConfig.from_environment()
        print(f"🔧 Runtime mode: {self.runtime_config.mode}")
        
        if self.runtime_config.mode == 'remote':
            print(f"🌐 Remote endpoint: {self.runtime_config.endpoint_url}")
            print(f"🤖 Agent ID: {self.runtime_config.agent_id}")
        
        # Validate configuration
        if not self.runtime_config.validate():
            raise ValueError(f"Invalid runtime configuration: {self.runtime_config.get_setup_instructions()}")
        
    def create_evaluation_dataset(self) -> str:
        """Create a basic evaluation dataset with sample farm management queries"""
        
        # Sample evaluation cases
        evaluation_examples = [
            {
                "inputs": {"prompt": "How many alpacas do we currently have on the farm?"},
                "outputs": {"expected_type": "herd_count", "should_use_tool": "alpaca_farm_assistant"}
            },
            {
                "inputs": {"prompt": "What is 15 + 27?"},
                "outputs": {"expected_type": "math_calculation", "should_use_tool": "math_assistant"}
            },
            {
                "inputs": {"prompt": "Translate 'Hello, how are you?' to Spanish"},
                "outputs": {"expected_type": "translation", "should_use_tool": "language_assistant"}
            },
            {
                "inputs": {"prompt": "Add a new alpaca named Fluffy to our herd"},
                "outputs": {"expected_type": "herd_management", "should_use_tool": "alpaca_farm_assistant"}
            },
            {
                "inputs": {"prompt": "What's the weather like today?"},
                "outputs": {"expected_type": "general_knowledge", "should_use_tool": "general_assistant"}
            },
            {
                "inputs": {"prompt": "Calculate the feed cost for 20 alpacas at $5 per alpaca per day for 30 days"},
                "outputs": {"expected_type": "math_calculation", "should_use_tool": "math_assistant"}
            },
            {
                "inputs": {"prompt": "Show me the health records for alpaca ID ALP-001"},
                "outputs": {"expected_type": "herd_management", "should_use_tool": "alpaca_farm_assistant"}
            }
        ]
        
        # Create dataset
        try:
            dataset = self.client.create_dataset(
                dataset_name=self.dataset_name,
                description="Basic evaluation dataset for alpaca farm assistant agent"
            )
            print(f"Created dataset: {self.dataset_name}")
        except Exception as e:
            if "already exists" in str(e).lower():
                print(f"Dataset {self.dataset_name} already exists, using existing dataset")
                dataset = self.client.read_dataset(dataset_name=self.dataset_name)
            else:
                raise e
        
        # Add examples to dataset
        for example in evaluation_examples:
            try:
                self.client.create_example(
                    inputs=example["inputs"],
                    outputs=example["outputs"],
                    dataset_id=dataset.id
                )
            except Exception as e:
                if "already exists" in str(e).lower():
                    continue
                else:
                    print(f"Warning: Could not add example: {e}")
        
        return dataset.id

    async def run_farm_assistant(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run the farm assistant agent and return results
        
        Args:
            inputs: Dictionary containing the prompt
            
        Returns:
            Dictionary with the agent's response and metadata
        """
        try:
            prompt = inputs.get("prompt", "")
            
            if self.runtime_config.mode == 'remote':
                # Use remote AgentCore runtime endpoint
                return await self._run_remote_agent(inputs)
            elif FARM_AGENT_AVAILABLE:
                # Use the local farm assistant agent
                return await self._run_local_agent(inputs)
            else:
                # Fallback to mock response for testing
                return await self._mock_farm_assistant(inputs)
            
        except Exception as e:
            return {
                "response": f"Error: {str(e)}",
                "tool_used": None,
                "success": False,
                "prompt": inputs.get("prompt", "")
            }
    
    async def _run_local_agent(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run the local farm assistant agent
        
        Args:
            inputs: Dictionary containing the prompt
            
        Returns:
            Dictionary with the agent's response and metadata
        """
        prompt = inputs.get("prompt", "")
        response_chunks = []
        tool_used = None
        
        # Create payload for the agent
        payload = {"prompt": prompt}
        
        # Run the async agent and collect streaming response
        async for chunk in strands_agent_bedrock(payload):
            if isinstance(chunk, str):
                # Check if this chunk indicates tool usage
                if "🔧 Using tool:" in chunk:
                    # Extract tool name from the chunk
                    tool_name = chunk.split("🔧 Using tool:")[1].strip()
                    tool_used = tool_name
                else:
                    # Regular response chunk
                    response_chunks.append(chunk)
        
        # Combine all response chunks
        full_response = "".join(response_chunks).strip()
        
        return {
            "response": full_response,
            "tool_used": tool_used,
            "success": len(full_response) > 0,
            "prompt": prompt,
            "runtime_mode": "local"
        }
    
    async def _run_remote_agent(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run the remote AgentCore runtime agent
        
        Args:
            inputs: Dictionary containing the prompt
            
        Returns:
            Dictionary with the agent's response and metadata
        """
        prompt = inputs.get("prompt", "")
        
        async with AgentCoreRemoteClient(self.runtime_config) as client:
            response_chunks = []
            tool_used = None
            
            # Create payload for the remote agent
            payload = {"prompt": prompt}
            
            # Call remote agent and collect streaming response
            async for chunk in client.invoke_agent_stream(payload):
                if isinstance(chunk, str):
                    # Check if this chunk indicates tool usage
                    if "🔧 Using tool:" in chunk:
                        # Extract tool name from the chunk
                        tool_name = chunk.split("🔧 Using tool:")[1].strip()
                        tool_used = tool_name
                    else:
                        # Regular response chunk
                        response_chunks.append(chunk)
            
            # Combine all response chunks
            full_response = "".join(response_chunks).strip()
            
            return {
                "response": full_response,
                "tool_used": tool_used,
                "success": len(full_response) > 0,
                "prompt": prompt,
                "runtime_mode": "remote",
                "endpoint": self.runtime_config.endpoint_url,
                "agent_id": self.runtime_config.agent_id
            }

    async def _mock_farm_assistant(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """
        Mock farm assistant for testing when real agent is not available
        """
        prompt = inputs.get("prompt", "").lower()
        
        # Simple routing logic based on keywords
        if any(word in prompt for word in ["alpaca", "herd", "farm", "animal"]):
            tool_used = "alpaca_farm_assistant"
            response = f"Mock alpaca farm response: Based on our records, I can help with alpaca management queries like '{inputs['prompt']}'"
        elif any(word in prompt for word in ["calculate", "math", "+", "-", "*", "/", "cost", "feed"]):
            tool_used = "math_assistant"
            response = f"Mock math calculation: I can help calculate that for you. For '{inputs['prompt']}', let me work through the numbers."
        elif any(word in prompt for word in ["translate", "spanish", "french", "german"]):
            tool_used = "language_assistant"
            response = f"Mock translation: I can translate that for you. '{inputs['prompt']}' involves language translation."
        else:
            tool_used = "general_assistant"
            response = f"Mock general response: I can provide general information about '{inputs['prompt']}'"
        
        # Simulate some processing time
        await asyncio.sleep(0.1)
        
        return {
            "response": response,
            "tool_used": tool_used,
            "success": True,
            "prompt": inputs['prompt']
        }

    def evaluate_response_quality(self, run: Run, example: Example) -> Dict[str, Any]:
        """
        Evaluate the quality of the agent's response
        
        Args:
            run: The run containing the agent's output
            example: The example containing expected outputs
            
        Returns:
            Dictionary with evaluation scores and feedback
        """
        try:
            # Get the actual response
            actual_output = run.outputs or {}
            expected_output = example.outputs or {}
            
            # Basic evaluation criteria
            scores = {}
            
            # Check if response was successful
            success = actual_output.get("success", False)
            scores["success"] = 1.0 if success else 0.0
            
            # Check if appropriate tool was used (if specified)
            expected_tool = expected_output.get("should_use_tool")
            actual_tool = actual_output.get("tool_used")
            
            if expected_tool:
                scores["correct_tool_usage"] = 1.0 if expected_tool in str(actual_tool) else 0.0
            else:
                scores["correct_tool_usage"] = 1.0  # No specific tool expected
            
            # Check response length (should not be empty)
            response_text = actual_output.get("response", "")
            scores["response_completeness"] = 1.0 if len(response_text.strip()) > 10 else 0.0
            
            # Overall score (average of individual scores)
            overall_score = sum(scores.values()) / len(scores)
            
            return {
                "key": "overall_quality",
                "score": overall_score,
                "feedback": f"Success: {success}, Tool: {actual_tool}, Scores: {scores}"
            }
            
        except Exception as e:
            return {
                "key": "overall_quality", 
                "score": 0.0,
                "feedback": f"Evaluation error: {str(e)}"
            }

    async def run_evaluation(self) -> Dict[str, Any]:
        """
        Run the complete async evaluation process
        
        Returns:
            Dictionary with evaluation results
        """
        mode_desc = f"({self.runtime_config.mode} mode)"
        print(f"Starting async LangSmith evaluation for Farm Assistant Agent {mode_desc}...")
        
        # Create dataset
        dataset_id = self.create_evaluation_dataset()
        
        # Create experiment name with runtime mode
        experiment_prefix = f"farm_assistant_{self.runtime_config.mode}_eval"
        description = f"Evaluation of farm assistant agent in {self.runtime_config.mode} mode"
        
        if self.runtime_config.mode == 'remote':
            description += f" using endpoint {self.runtime_config.endpoint_url}"
        
        # Run async evaluation
        results = await aevaluate(
            self.run_farm_assistant,
            data=self.dataset_name,
            evaluators=[self.evaluate_response_quality],
            experiment_prefix=experiment_prefix,
            description=description
        )
        
        print(f"Evaluation completed! Results: {results}")
        return results

    def run_evaluation_sync(self) -> Dict[str, Any]:
        """
        Synchronous wrapper for the async evaluation
        
        Returns:
            Dictionary with evaluation results
        """
        return asyncio.run(self.run_evaluation())

async def main_async():
    """Async main function to run the evaluation"""
    
    # Check for LangSmith API key
    api_key = os.getenv("LANGSMITH_API_KEY")
    if not api_key:
        print("Warning: LANGSMITH_API_KEY not found in environment variables.")
        print("Please set your LangSmith API key:")
        print("export LANGSMITH_API_KEY='your-api-key-here'")
        return
    
    # Initialize runtime configuration
    try:
        runtime_config = RuntimeConfig.from_environment()
        print(f"🔧 Runtime Configuration:")
        print(runtime_config.get_setup_instructions())
    except Exception as e:
        print(f"❌ Configuration error: {e}")
        return
    
    # Initialize evaluator
    evaluator = FarmAssistantEvaluator(runtime_config=runtime_config)
    
    # Run evaluation
    try:
        print(f"🤖 Farm Agent Available (local): {FARM_AGENT_AVAILABLE}")
        print(f"🌐 Runtime Mode: {runtime_config.mode}")
        
        results = await evaluator.run_evaluation()
        print("\n" + "="*50)
        print("EVALUATION SUMMARY")
        print("="*50)
        print(f"Runtime Mode: {runtime_config.mode}")
        if runtime_config.mode == 'remote':
            print(f"Endpoint: {runtime_config.endpoint_url}")
            print(f"Agent ID: {runtime_config.agent_id}")
        print(f"Results: {results}")
        
    except Exception as e:
        print(f"Evaluation failed: {str(e)}")
        print("Make sure you have:")
        print("1. LangSmith API key set")
        print("2. langsmith package installed: pip install langsmith")
        print("3. Proper network access to LangSmith")
        if runtime_config.mode == 'local':
            print("4. Farm assistant dependencies available")
        else:
            print("4. Valid AgentCore endpoint configuration")
            print("5. AWS credentials configured (if required)")
            print("6. Network access to AgentCore endpoint")

def main():
    """Synchronous main function wrapper"""
    asyncio.run(main_async())

if __name__ == "__main__":
    main()