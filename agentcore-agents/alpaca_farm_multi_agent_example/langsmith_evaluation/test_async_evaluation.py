#!/usr/bin/env python3
"""
Test script for async LangSmith evaluation

This script tests the async functionality without running a full evaluation.
"""

import asyncio
import os
from langsmith_evaluation import FarmAssistantEvaluator

async def test_single_query():
    """Test a single query with the async farm assistant"""
    print("🧪 Testing async farm assistant functionality...")
    
    # Check API key
    if not os.getenv("LANGSMITH_API_KEY"):
        print("❌ LANGSMITH_API_KEY not set")
        return False
    
    # Initialize evaluator
    evaluator = FarmAssistantEvaluator()
    
    # Test queries
    test_queries = [
        {"prompt": "How many alpacas do we have on the farm?"},
        {"prompt": "Calculate 15 + 25 * 3"},
        {"prompt": "Translate 'hello world' to Spanish"},
        {"prompt": "What's the weather like today?"}
    ]
    
    print("🔄 Testing individual queries...")
    
    for i, query in enumerate(test_queries, 1):
        try:
            print(f"\n📝 Test {i}: {query['prompt']}")
            
            # Run the async function
            result = await evaluator.run_farm_assistant(query)
            
            print(f"   ✅ Response: {result.get('response', 'No response')[:100]}...")
            print(f"   🔧 Tool: {result.get('tool_used', 'Unknown')}")
            print(f"   ✅ Success: {result.get('success', False)}")
            
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            return False
    
    print("\n🎉 All async tests passed!")
    return True

async def test_mini_evaluation():
    """Run a mini evaluation with just one test case"""
    print("\n🚀 Testing mini async evaluation...")
    
    try:
        evaluator = FarmAssistantEvaluator()
        
        # Override dataset name for testing
        evaluator.dataset_name = "test_async_mini"
        
        # Create a minimal dataset
        test_case = {
            "inputs": {"prompt": "How many alpacas do we have?"},
            "outputs": {"expected_type": "herd_count", "should_use_tool": "alpaca_farm_assistant"}
        }
        
        # Create dataset with single example
        try:
            dataset = evaluator.client.create_dataset(
                dataset_name=evaluator.dataset_name,
                description="Mini test dataset for async evaluation"
            )
            print(f"✅ Created test dataset: {evaluator.dataset_name}")
        except Exception as e:
            if "already exists" in str(e).lower():
                print(f"✅ Using existing test dataset: {evaluator.dataset_name}")
                dataset = evaluator.client.read_dataset(dataset_name=evaluator.dataset_name)
            else:
                raise e
        
        # Add test example
        try:
            evaluator.client.create_example(
                inputs=test_case["inputs"],
                outputs=test_case["outputs"],
                dataset_id=dataset.id
            )
        except Exception as e:
            if "already exists" not in str(e).lower():
                print(f"Warning: Could not add example: {e}")
        
        print("🔄 Running mini evaluation...")
        
        # Run the evaluation
        results = await evaluator.run_evaluation()
        
        print(f"✅ Mini evaluation completed: {results}")
        return True
        
    except Exception as e:
        print(f"❌ Mini evaluation failed: {str(e)}")
        return False

async def main():
    """Main test function"""
    print("🦙 Async Farm Assistant Evaluation Test")
    print("="*50)
    
    # Test 1: Individual queries
    success1 = await test_single_query()
    
    if success1:
        # Test 2: Mini evaluation
        success2 = await test_mini_evaluation()
        
        if success2:
            print("\n🎉 All async tests completed successfully!")
            print("✅ Your async LangSmith evaluation is ready to use!")
        else:
            print("\n⚠️  Individual queries work, but evaluation failed")
    else:
        print("\n❌ Basic async functionality failed")

if __name__ == "__main__":
    asyncio.run(main())