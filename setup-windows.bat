@echo off
echo.
echo ====================================================
echo   FacEvent - Setup Script (Windows)
echo ====================================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.10 from https://python.org
    pause
    exit /b 1
)

:: Check Node
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

echo [1/5] Setting up Backend...
cd backend

if not exist ".env" (
    copy .env.example .env
    echo [INFO] Created backend/.env - EDIT THIS FILE with your Cloudinary keys!
)

python -m venv venv
call venv\Scripts\activate

echo [2/5] Installing Python dependencies (this may take a few minutes)...
echo      dlib/face_recognition may need Visual C++ Build Tools
pip install cmake
pip install dlib
pip install -r requirements.txt

if errorlevel 1 (
    echo.
    echo [WARN] Some packages failed. If dlib failed:
    echo   1. Install Visual Studio Build Tools from:
    echo      https://visualstudio.microsoft.com/visual-cpp-build-tools/
    echo   2. Or use pre-built dlib wheel:
    echo      pip install https://github.com/jloh02/dlib/releases/download/v19.22/dlib-19.22.99-cp310-cp310-win_amd64.whl
    echo   3. Then re-run: pip install face_recognition
)

cd ..

echo [3/5] Setting up Frontend...
cd frontend

if not exist ".env" (
    copy .env.example .env
)

echo [4/5] Installing Node dependencies...
npm install

cd ..

echo.
echo [5/5] Setup complete!
echo.
echo ====================================================
echo   IMPORTANT: Configure your Cloudinary keys!
echo   Edit: backend/.env
echo ====================================================
echo.
echo   CLOUDINARY_CLOUD_NAME=your_cloud_name
echo   CLOUDINARY_API_KEY=your_api_key
echo   CLOUDINARY_API_SECRET=your_api_secret
echo.
echo   Get these from: https://cloudinary.com/console
echo.
echo ====================================================
echo   To start the app:
echo   1. Run: start-backend.bat
echo   2. Run: start-frontend.bat  (in new terminal)
echo   3. Open: http://localhost:3000
echo ====================================================
echo.
pause
