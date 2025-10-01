#!/usr/bin/env python3
"""
Example Usage of Farm Assistant Evaluation with Runtime Configuration

This script demonstrates how to run evaluations in both local and remote modes.
"""

import os
import asyncio
from runtime_config import RuntimeConfig
from langsmith_evaluation import FarmAssistantEvaluator


async def test_local_mode():
    """Test evaluation in local mode"""
    print("🏠 Testing Local Mode")
    print("=" * 40)
    
    # Set local mode
    os.environ['FARM_ASSISTANT_RUNTIME_MODE'] = 'local'
    
    try:
        config = RuntimeConfig.from_environment()
        evaluator = FarmAssistantEvaluator(runtime_config=config)
        
        # Test a single query
        result = await evaluator.run_farm_assistant({
            "prompt": "How many alpacas do we have on the farm?"
        })
        
        print(f"✅ Local test successful!")
        print(f"   Response: {result.get('response', 'No response')[:100]}...")
        print(f"   Tool used: {result.get('tool_used', 'None')}")
        print(f"   Runtime: {result.get('runtime_mode', 'unknown')}")
        
    except Exception as e:
        print(f"❌ Local test failed: {e}")


async def test_remote_mode():
    """Test evaluation in remote mode"""
    print("\n☁️  Testing Remote Mode")
    print("=" * 40)
    
    # Check if remote configuration is available
    endpoint = os.getenv('AGENTCORE_ENDPOINT_URL') or os.getenv('AGENTCORE_ARN')
    agent_id = os.getenv('AGENTCORE_AGENT_ID')
    
    if not endpoint and not agent_id:
        print("⚠️  Remote mode configuration not found.")
        print("   Set AGENTCORE_ARN, AGENTCORE_AGENT_ID, or AGENTCORE_ENDPOINT_URL to test remote mode.")
        return
    
    # Set remote mode
    os.environ['FARM_ASSISTANT_RUNTIME_MODE'] = 'remote'
    
    try:
        config = RuntimeConfig.from_environment()
        evaluator = FarmAssistantEvaluator(runtime_config=config)
        
        # Test a single query
        result = await evaluator.run_farm_assistant({
            "prompt": "How many alpacas do we have on the farm?"
        })
        
        print(f"✅ Remote test successful!")
        print(f"   Response: {result.get('response', 'No response')[:100]}...")
        print(f"   Tool used: {result.get('tool_used', 'None')}")
        print(f"   Runtime: {result.get('runtime_mode', 'unknown')}")
        print(f"   Endpoint: {result.get('endpoint', 'unknown')}")
        print(f"   Agent ID: {result.get('agent_id', 'unknown')}")
        
    except Exception as e:
        print(f"❌ Remote test failed: {e}")


async def run_comparative_evaluation():
    """Run evaluation in both modes for comparison"""
    print("\n🔄 Running Comparative Evaluation")
    print("=" * 50)
    
    # Check if we can run both modes
    endpoint = os.getenv('AGENTCORE_ENDPOINT_URL') or os.getenv('AGENTCORE_ARN')
    agent_id = os.getenv('AGENTCORE_AGENT_ID')
    
    if not endpoint and not agent_id:
        print("⚠️  Remote configuration missing. Running local mode only.")
        
        # Run local evaluation
        os.environ['FARM_ASSISTANT_RUNTIME_MODE'] = 'local'
        config = RuntimeConfig.from_environment()
        evaluator = FarmAssistantEvaluator(runtime_config=config)
        
        print("🏠 Running local evaluation...")
        results = await evaluator.run_evaluation()
        print(f"Local results: {results}")
        return
    
    # Run both modes
    modes = ['local', 'remote']
    results = {}
    
    for mode in modes:
        print(f"\n🔧 Running {mode} mode evaluation...")
        
        os.environ['FARM_ASSISTANT_RUNTIME_MODE'] = mode
        
        try:
            config = RuntimeConfig.from_environment()
            evaluator = FarmAssistantEvaluator(runtime_config=config)
            
            mode_results = await evaluator.run_evaluation()
            results[mode] = mode_results
            
            print(f"✅ {mode.title()} mode completed successfully")
            
        except Exception as e:
            print(f"❌ {mode.title()} mode failed: {e}")
            results[mode] = {"error": str(e)}
    
    print("\n📊 Comparative Results Summary:")
    print("=" * 50)
    for mode, result in results.items():
        print(f"{mode.title()} Mode: {result}")


def show_configuration_examples():
    """Show configuration examples"""
    print("🔧 Configuration Examples")
    print("=" * 40)
    
    print("\n1. Local Mode (Default):")
    print("   export FARM_ASSISTANT_RUNTIME_MODE=local")
    print("   export LANGSMITH_API_KEY=your-langsmith-key")
    
    print("\n2. Remote Mode:")
    print("   export FARM_ASSISTANT_RUNTIME_MODE=remote")
    print("   export AGENTCORE_ARN=arn:aws:bedrock-agentcore:us-west-2:339713026409:runtime/strandsagent-Dft6C798dZ")
    print("   # OR export AGENTCORE_AGENT_ID=strandsagent-Dft6C798dZ")
    print("   export LANGSMITH_API_KEY=your-langsmith-key")
    print("   export AWS_REGION=us-west-2")
    
    print("\n3. Current Configuration:")
    try:
        config = RuntimeConfig.from_environment()
        print(f"   Mode: {config.mode}")
        if config.mode == 'remote':
            print(f"   ARN/Endpoint: {config.endpoint_url or 'Not set'}")
            print(f"   Agent ID: {config.agent_id or 'Not set'}")
    except Exception as e:
        print(f"   Error: {e}")


async def main():
    """Main function"""
    print("🦙 Farm Assistant Evaluation - Runtime Configuration Examples")
    print("=" * 70)
    
    # Show configuration examples
    show_configuration_examples()
    
    # Test individual modes
    await test_local_mode()
    await test_remote_mode()
    
    # Ask user if they want to run full comparative evaluation
    print("\n" + "=" * 70)
    response = input("Run full comparative evaluation? (y/N): ").strip().lower()
    
    if response in ['y', 'yes']:
        await run_comparative_evaluation()
    else:
        print("👋 Evaluation examples completed!")


if __name__ == "__main__":
    asyncio.run(main())