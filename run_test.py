import sys
import os
import subprocess

print("sys.executable is", sys.executable)
subprocess.run([sys.executable, "test_browser2.py"])