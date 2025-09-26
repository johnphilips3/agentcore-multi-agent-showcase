#!/usr/bin/env python3
"""
Simple evaluation runner for the Farm Assistant Agent

This script provides an easy way to run LangSmith evaluations on your farm assistant.
"""

import os
import sys
import asyncio
from langsmith_config import LangSmithConfig, get_sample_dataset
from langsmith_evaluation import FarmAssistantEvaluator

def check_prerequisites():
    """Check if all prerequisites are met"""
    print("🔍 Checking prerequisites...")
    
    # Check if langsmith is installed
    try:
        import langsmith
        print("✅ LangSmith package found")
    except ImportError:
        print("❌ LangSmith not installed. Run: pip install langsmith")
        return False
    
    # Check configuration
    config = LangSmithConfig()
    if not config.validate_config():
        print(config.get_environment_setup_instructions())
        return False
    
    print("✅ Configuration valid")
    return True

async def run_basic_evaluation_async():
    """Run a basic async evaluation of the farm assistant"""
    print("\n🚀 Starting Farm Assistant Evaluation...")
    
    try:
        # Initialize evaluator
        evaluator = FarmAssistantEvaluator()
        
        # Run async evaluation
        results = await evaluator.run_evaluation()
        
        print("\n" + "="*60)
        print("📊 EVALUATION RESULTS")
        print("="*60)
        
        if results:
            print(f"✅ Evaluation completed successfully!")
            print(f"📈 Check your LangSmith dashboard for detailed results")
            print(f"🔗 Visit: https://smith.langchain.com/")
        else:
            print("⚠️  Evaluation completed but no results returned")
            
    except Exception as e:
        print(f"❌ Evaluation failed: {str(e)}")
        print("\n🔧 Troubleshooting tips:")
        print("1. Verify your LANGSMITH_API_KEY is correct")
        print("2. Check your internet connection")
        print("3. Ensure all dependencies are installed")
        print("4. Check farm assistant agent dependencies")
        return False
    
    return True

def run_basic_evaluation():
    """Synchronous wrapper for async evaluation"""
    return asyncio.run(run_basic_evaluation_async())

def interactive_mode():
    """Run in interactive mode for testing individual queries"""
    print("\n🎯 Interactive Testing Mode")
    print("Type 'quit' to exit")
    
    evaluator = FarmAssistantEvaluator()
    
    while True:
        try:
            query = input("\n💬 Enter a query for the farm assistant: ").strip()
            
            if query.lower() in ['quit', 'exit', 'q']:
                print("👋 Goodbye!")
                break
            
            if not query:
                continue
            
            print("🤔 Processing...")
            
            # Run single query
            result = asyncio.run(evaluator.run_farm_assistant({"prompt": query}))
            
            print(f"\n📝 Response: {result.get('response', 'No response')}")
            print(f"🔧 Tool used: {result.get('tool_used', 'Unknown')}")
            print(f"✅ Success: {result.get('success', False)}")
            
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"❌ Error: {str(e)}")

def main():
    """Main function"""
    print("🦙 Farm Assistant LangSmith Evaluation Tool")
    print("="*50)
    
    # Check prerequisites
    if not check_prerequisites():
        sys.exit(1)
    
    # Show options
    print("\nChoose an option:")
    print("1. Run full evaluation suite")
    print("2. Interactive testing mode")
    print("3. Show configuration")
    
    try:
        choice = input("\nEnter your choice (1-3): ").strip()
        
        if choice == "1":
            success = run_basic_evaluation()
            sys.exit(0 if success else 1)
            
        elif choice == "2":
            interactive_mode()
            
        elif choice == "3":
            config = LangSmithConfig()
            print(f"\n📋 Current Configuration:")
            print(f"   API Key: {'✅ Set' if config.api_key else '❌ Not set'}")
            print(f"   Project: {config.project_name}")
            print(f"   Dataset: {config.dataset_name}")
            print(config.get_environment_setup_instructions())
            
        else:
            print("❌ Invalid choice")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
        sys.exit(0)

if __name__ == "__main__":
    main()