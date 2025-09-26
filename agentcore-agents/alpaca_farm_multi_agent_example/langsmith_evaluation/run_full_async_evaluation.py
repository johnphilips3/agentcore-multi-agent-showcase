#!/usr/bin/env python3
"""
Full async evaluation runner for Farm Assistant Agent

This script runs a comprehensive async evaluation of your farm assistant agent.
"""

import asyncio
import os
from langsmith_evaluation import FarmAssistantEvaluator, FARM_AGENT_AVAILABLE

async def run_comprehensive_evaluation():
    """Run a comprehensive evaluation with multiple test scenarios"""
    
    print("🦙 Farm Assistant Comprehensive Async Evaluation")
    print("="*60)
    
    # Check prerequisites
    api_key = os.getenv("LANGSMITH_API_KEY")
    if not api_key:
        print("❌ LANGSMITH_API_KEY not found")
        print("Please set your API key: export LANGSMITH_API_KEY='your-key-here'")
        return False
    
    print(f"✅ LangSmith API key configured")
    print(f"🤖 Real farm agent available: {FARM_AGENT_AVAILABLE}")
    
    # Initialize evaluator
    evaluator = FarmAssistantEvaluator()
    
    # Test individual queries first
    print("\n🧪 Testing individual queries...")
    
    test_queries = [
        {
            "prompt": "How many alpacas do we currently have on the farm?",
            "expected_category": "alpaca_management"
        },
        {
            "prompt": "Calculate the feed cost for 25 alpacas at $4.50 per day for 30 days",
            "expected_category": "math"
        },
        {
            "prompt": "Translate 'healthy alpaca' to Spanish",
            "expected_category": "translation"
        },
        {
            "prompt": "Add a new alpaca named Snowball with white fleece to our herd",
            "expected_category": "alpaca_management"
        },
        {
            "prompt": "What's the best way to store hay?",
            "expected_category": "general"
        }
    ]
    
    individual_results = []
    
    for i, query in enumerate(test_queries, 1):
        try:
            print(f"\n📝 Query {i}: {query['prompt']}")
            
            result = await evaluator.run_farm_assistant({"prompt": query['prompt']})
            
            print(f"   🔧 Tool used: {result.get('tool_used', 'Unknown')}")
            print(f"   ✅ Success: {result.get('success', False)}")
            print(f"   📄 Response length: {len(result.get('response', ''))}")
            
            individual_results.append({
                "query": query,
                "result": result,
                "success": result.get('success', False)
            })
            
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            individual_results.append({
                "query": query,
                "result": None,
                "success": False
            })
    
    # Summary of individual tests
    successful_queries = sum(1 for r in individual_results if r['success'])
    print(f"\n📊 Individual Query Results: {successful_queries}/{len(test_queries)} successful")
    
    # Run full evaluation
    print(f"\n🚀 Running full LangSmith evaluation...")
    
    try:
        results = await evaluator.run_evaluation()
        
        print("\n" + "="*60)
        print("📈 COMPREHENSIVE EVALUATION RESULTS")
        print("="*60)
        
        print(f"✅ Full evaluation completed successfully!")
        print(f"🔗 View detailed results at: https://smith.langchain.com/")
        
        if FARM_AGENT_AVAILABLE:
            print(f"🤖 Used real farm assistant agent")
        else:
            print(f"🎭 Used mock agent (install farm assistant dependencies for real testing)")
        
        return True
        
    except Exception as e:
        print(f"❌ Full evaluation failed: {str(e)}")
        return False

async def main():
    """Main async function"""
    success = await run_comprehensive_evaluation()
    
    if success:
        print("\n🎉 Comprehensive evaluation completed!")
        print("\n📋 Next steps:")
        print("1. Check your LangSmith dashboard for detailed metrics")
        print("2. Review agent routing accuracy")
        print("3. Analyze response quality scores")
        print("4. Set up automated evaluation runs")
    else:
        print("\n❌ Evaluation failed. Check the error messages above.")

if __name__ == "__main__":
    asyncio.run(main())