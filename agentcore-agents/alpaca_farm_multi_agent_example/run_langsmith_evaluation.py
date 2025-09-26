#!/usr/bin/env python3
"""
Convenience script to run LangSmith evaluation from the main directory

This script allows you to run the LangSmith evaluation without navigating
to the langsmith_evaluation subdirectory.
"""

import os
import sys
import subprocess

def main():
    """Run LangSmith evaluation from main directory"""
    
    print("🦙 Farm Assistant LangSmith Evaluation")
    print("="*50)
    
    # Get the path to the langsmith_evaluation directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    langsmith_dir = os.path.join(current_dir, "langsmith_evaluation")
    
    if not os.path.exists(langsmith_dir):
        print("❌ LangSmith evaluation directory not found!")
        print(f"Expected: {langsmith_dir}")
        return 1
    
    print(f"📁 LangSmith evaluation directory: {langsmith_dir}")
    
    # Show available options
    print("\nChoose an evaluation to run:")
    print("1. Test async functionality")
    print("2. Run comprehensive evaluation") 
    print("3. Interactive evaluation")
    print("4. Test LangSmith connection")
    
    try:
        choice = input("\nEnter your choice (1-4): ").strip()
        
        # Map choices to scripts
        scripts = {
            "1": "test_async_evaluation.py",
            "2": "run_full_async_evaluation.py", 
            "3": "run_evaluation.py",
            "4": "test_langsmith_connection.py"
        }
        
        if choice not in scripts:
            print("❌ Invalid choice")
            return 1
        
        script_name = scripts[choice]
        script_path = os.path.join(langsmith_dir, script_name)
        
        if not os.path.exists(script_path):
            print(f"❌ Script not found: {script_path}")
            return 1
        
        print(f"\n🚀 Running: {script_name}")
        print("-" * 50)
        
        # Run the selected script
        result = subprocess.run([
            sys.executable, script_name
        ], cwd=langsmith_dir)
        
        return result.returncode
        
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
        return 0
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())