#!/usr/bin/env python3
"""
Debug wrapper for Streamlit app.
This script starts the Streamlit app with debugging enabled.
"""

import debugpy
import subprocess
import sys
import os

def main():
    # Enable debugging
    debugpy.listen(5678)
    print("🐛 Debugger listening on port 5678")
    print("🔗 You can now attach VS Code debugger")
    print("⏳ Waiting for debugger to attach...")
    
    # Wait for debugger (optional - comment out if you don't want to wait)
    debugpy.wait_for_client()
    print("✅ Debugger attached!")
    
    # Import and run the app
    print("🚀 Starting Streamlit app...")
    
    # Method 1: Import streamlit and run programmatically
    try:
        import streamlit.web.cli as stcli
        sys.argv = [
            "streamlit",
            "run",
            "app.py",
            "--server.port=8501",
            "--server.headless=true"
        ]
        stcli.main()
    except Exception as e:
        print(f"❌ Error running Streamlit: {e}")
        # Method 2: Fallback to subprocess
        subprocess.run([
            sys.executable, "-m", "streamlit", "run", "app.py",
            "--server.port=8501"
        ])

if __name__ == "__main__":
    main()