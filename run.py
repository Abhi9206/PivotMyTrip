#!/usr/bin/env python3
"""
NomadAI startup script - runs both backend and frontend
"""
import os
import sys
import subprocess
import time
from pathlib import Path

def run_backend():
    """Start the FastAPI backend server"""
    print("Starting backend server...")
    backend_path = Path(__file__).parent / "backend"
    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "backend.main:app",
        "--reload",
        "--port",
        "8000"
    ]
    return subprocess.Popen(cmd, cwd=Path(__file__).parent)

def run_frontend():
    """Start the Vite frontend development server"""
    print("Starting frontend server...")
    frontend_path = Path(__file__).parent / "client"
    cmd = ["npm", "run", "dev"]
    return subprocess.Popen(cmd, cwd=frontend_path)

if __name__ == "__main__":
    print("Starting NomadAI development environment...")

    # Start backend
    backend_process = run_backend()
    time.sleep(2)

    # Start frontend
    frontend_process = run_frontend()

    try:
        print("\n✓ Backend running on http://localhost:8000")
        print("✓ Frontend running on http://localhost:5173")
        print("\nPress Ctrl+C to stop both servers...\n")
        backend_process.wait()
        frontend_process.wait()
    except KeyboardInterrupt:
        print("\n\nShutting down servers...")
        backend_process.terminate()
        frontend_process.terminate()
        backend_process.wait()
        frontend_process.wait()
        print("Servers stopped.")

