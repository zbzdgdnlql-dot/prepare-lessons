import subprocess
import os
import sys
import threading
import time
import webbrowser

def run_backend():
    """启动 FastAPI 后端"""
    print("[1/2] 正在启动 FastAPI 后端服务...")
    backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
    
    # 获取当前正在运行此脚本的 Python 解释器路径
    python_exe = sys.executable
    
    try:
        # 使用当前 Python 运行 uvicorn
        process = subprocess.Popen(
            [python_exe, "-m", "uvicorn", "main:app", "--reload", "--host", "127.0.0.1", "--port", "8000"],
            cwd=backend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        
        # 实时打印后端日志
        for line in process.stdout:
            print(f"[后端] {line.strip()}")
            
    except Exception as e:
        print(f"[错误] 后端启动失败: {e}")

def run_frontend():
    """启动 Vite 前端"""
    print("[2/2] 正在启动 Vite 前端服务...")
    frontend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")
    
    # 决定使用 npm 还是 npm.cmd (Windows 下通常是 npm.cmd)
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    
    try:
        process = subprocess.Popen(
            [npm_cmd, "run", "dev"],
            cwd=frontend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        
        # 实时打印前端日志
        for line in process.stdout:
            print(f"[前端] {line.strip()}")
            
    except Exception as e:
        print(f"[错误] 前端启动失败: {e}")

def open_browser():
    """延迟几秒后自动打开浏览器"""
    print("等待服务启动，3秒后自动打开浏览器...")
    time.sleep(3)
    url = "http://localhost:5173"
    print(f"正在浏览器中打开: {url}")
    webbrowser.open(url)

if __name__ == "__main__":
    print("="*60)
    print("        正在启动 Français Pro AI 备课平台")
    print("="*60)
    
    try:
        # 创建线程来分别运行前端和后端，防止阻塞主线程
        backend_thread = threading.Thread(target=run_backend, daemon=True)
        frontend_thread = threading.Thread(target=run_frontend, daemon=True)
        browser_thread = threading.Thread(target=open_browser, daemon=True)
        
        # 启动线程
        backend_thread.start()
        frontend_thread.start()
        browser_thread.start()
        
        print("\n提示: 服务正在后台运行中。按 Ctrl+C 可以停止所有服务并退出。\n")
        
        # 保持主线程运行，直到用户按下 Ctrl+C
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n")
        print("="*60)
        print("正在关闭服务，请稍候...")
        print("="*60)
        # sys.exit() 会结束主线程，daemon=True 的子线程也会随之结束
        sys.exit(0)