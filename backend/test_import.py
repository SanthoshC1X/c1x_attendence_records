#!/usr/bin/env python3
"""
Simple test script to verify all imports work correctly.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    print("Testing imports...")
    
    # Test individual modules first
    import parser
    print("✓ parser.py imported successfully")
    
    import analytics
    print("✓ analytics.py imported successfully")
    
    # Test main app
    import main
    print("✓ main.py imported successfully")
    
    print("\n🎉 All imports successful! Backend should start without errors.")
    print("\nYou can now run: uvicorn main:app --reload --port 8000")
    
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Make sure you're in the backend directory and have installed requirements.txt")
except Exception as e:
    print(f"❌ Unexpected error: {e}")