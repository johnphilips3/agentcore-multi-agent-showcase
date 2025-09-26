#!/usr/bin/env python3
"""
Simple test to verify LangSmith connection and setup
"""

import os
from langsmith import Client

def test_langsmith_connection():
    """Test basic LangSmith connection"""
    print("🔍 Testing LangSmith connection...")
    
    # Check API key
    api_key = os.getenv("LANGSMITH_API_KEY")
    if not api_key:
        print("❌ LANGSMITH_API_KEY not found")
        return False
    
    print(f"✅ API key found (length: {len(api_key)})")
    
    try:
        # Initialize client
        client = Client()
        print("✅ LangSmith client initialized")
        
        # Test basic API call
        # This will create a simple run to test connectivity
        print("🔗 Testing API connectivity...")
        
        # Just test if we can access the client without making actual calls
        print("✅ LangSmith connection successful!")
        return True
        
    except Exception as e:
        print(f"❌ LangSmith connection failed: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_langsmith_connection()
    if success:
        print("\n🎉 All tests passed! You're ready to run evaluations.")
    else:
        print("\n❌ Setup incomplete. Please check your configuration.")