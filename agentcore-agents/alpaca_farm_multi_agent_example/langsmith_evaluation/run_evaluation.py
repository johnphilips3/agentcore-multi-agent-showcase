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
from runtime_config import RuntimeConfig

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
    
    # Check LangSmith configuration
    config = LangSmithConfig()
    if not config.validate_config():
        print(config.get_environment_setup_instructions())
        return False
    
    print("✅ LangSmith configuration valid")
    
    # Check runtime configuration
    try:
        runtime_config = RuntimeConfig.from_environment()
        if not runtime_config.validate():
            print("❌ Runtime configuration invalid")
            print(runtime_config.get_setup_instructions())
            return False
        
        print(f"✅ Runtime configuration valid ({runtime_config.mode} mode)")
        
        if runtime_config.mode == 'remote':
            print(f"   🌐 Agent Runtime URL: {runtime_config.endpoint_url}")
            print(f"   🤖 Agent ID: {runtime_config.agent_id}")
        
    except Exception as e:
        print(f"❌ Runtime configuration error: {e}")
        return False
    
    return True

async def run_basic_evaluation_async():
    """Run a basic async evaluation of the farm assistant"""
    
    # Get runtime configuration
    try:
        runtime_config = RuntimeConfig.from_environment()
        mode_desc = f"({runtime_config.mode} mode)"
    except Exception as e:
        print(f"❌ Configuration error: {e}")
        return False
    
    print(f"\n🚀 Starting Farm Assistant Evaluation {mode_desc}...")
    
    try:
        # Initialize evaluator with runtime config
        evaluator = FarmAssistantEvaluator(runtime_config=runtime_config)
        
        # Run async evaluation
        results = await evaluator.run_evaluation()
        
        print("\n" + "="*60)
        print("📊 EVALUATION RESULTS")
        print("="*60)
        print(f"Runtime Mode: {runtime_config.mode}")
        
        if runtime_config.mode == 'remote':
            print(f"Endpoint: {runtime_config.endpoint_url}")
            print(f"Agent ID: {runtime_config.agent_id}")
        
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
        
        if runtime_config.mode == 'local':
            print("4. Check farm assistant agent dependencies")
        else:
            print("4. Verify AgentCore endpoint configuration")
            print("5. Check AWS credentials (if required)")
            print("6. Ensure network access to AgentCore endpoint")
        
        return False
    
    return True

def run_basic_evaluation():
    """Synchronous wrapper for async evaluation"""
    return asyncio.run(run_basic_evaluation_async())

def interactive_mode():
    """Run in interactive mode for testing individual queries"""
    
    # Get runtime configuration
    try:
        runtime_config = RuntimeConfig.from_environment()
        mode_desc = f"({runtime_config.mode} mode)"
    except Exception as e:
        print(f"❌ Configuration error: {e}")
        return
    
    print(f"\n🎯 Interactive Testing Mode {mode_desc}")
    print("Type 'quit' to exit")
    
    if runtime_config.mode == 'remote':
        print(f"🌐 Using endpoint: {runtime_config.endpoint_url}")
        print(f"🤖 Agent ID: {runtime_config.agent_id}")
    
    evaluator = FarmAssistantEvaluator(runtime_config=runtime_config)
    
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
            print(f"🌐 Runtime: {result.get('runtime_mode', 'unknown')}")
            
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
            # Show LangSmith configuration
            config = LangSmithConfig()
            print(f"\n📋 LangSmith Configuration:")
            print(f"   API Key: {'✅ Set' if config.api_key else '❌ Not set'}")
            print(f"   Project: {config.project_name}")
            print(f"   Dataset: {config.dataset_name}")
            
            # Show runtime configuration
            try:
                runtime_config = RuntimeConfig.from_environment()
                print(f"\n🔧 Runtime Configuration:")
                print(f"   Mode: {runtime_config.mode}")
                if runtime_config.mode == 'remote':
                    print(f"   Endpoint: {runtime_config.endpoint_url or '❌ Not set'}")
                    print(f"   Agent ID: {runtime_config.agent_id or '❌ Not set'}")
                    print(f"   Session ID: {runtime_config.session_id or 'Not set (optional)'}")
                    print(f"   AWS Region: {runtime_config.aws_region}")
                
                print(runtime_config.get_setup_instructions())
            except Exception as e:
                print(f"❌ Runtime configuration error: {e}")
            
            print(config.get_environment_setup_instructions())
            
        else:
            print("❌ Invalid choice")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
        sys.exit(0)

if __name__ == "__main__":
    main()