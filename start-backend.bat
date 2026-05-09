@echo off
cd backend
call venv\Scripts\activate
echo Starting FacEvent backend on http://localhost:8000
echo API docs available at http://localhost:8000/docs
python main.py
pause
