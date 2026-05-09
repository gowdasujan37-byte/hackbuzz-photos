# FacEvent — AI Face Recognition Event Photo System

> Upload event photos → AI indexes all faces → Students find their photos with a selfie.

---

## What's Included

```
facevent/
├── backend/                  ← Python FastAPI backend
│   ├── main.py               ← App entry point + CORS
│   ├── database.py           ← SQLite DB (upgradeable to Postgres/Supabase)
│   ├── face_service.py       ← Face detection + embedding + matching
│   ├── cloudinary_service.py ← Image upload/delete via Cloudinary API
│   ├── routers/
│   │   ├── upload.py         ← POST /api/upload/photos (bulk upload)
│   │   ├── search.py         ← POST /api/search/face (find by selfie)
│   │   └── admin.py          ← GET /api/admin/stats, photos, DELETE
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                 ← React + Vite + Tailwind frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── HomePage.jsx  ← Landing page
│   │   │   ├── UploadPage.jsx← Photographer bulk upload UI
│   │   │   ├── SearchPage.jsx← Student selfie search UI
│   │   │   └── AdminPage.jsx ← Stats + photo management table
│   │   ├── components/
│   │   │   └── Navbar.jsx
│   │   └── App.jsx
│   ├── package.json
│   └── .env.example
│
├── setup-windows.bat
├── setup-mac-linux.sh
├── start-backend.bat / .sh
├── start-frontend.bat / .sh
└── README.md
```

---

## Quick Start (5 Steps)

### Step 1: Get Cloudinary Keys
1. Go to [cloudinary.com](https://cloudinary.com) and log in
2. On your Dashboard, find your **Cloud Name**, **API Key**, **API Secret**

### Step 2: Configure Environment
```bash
# Copy the example and fill in your keys
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
```

### Step 3: Run Setup Script

**Windows:**
```
Double-click: setup-windows.bat
```

**Mac/Linux:**
```bash
chmod +x setup-mac-linux.sh && ./setup-mac-linux.sh
```

### Step 4: Start the App

**Terminal 1 — Backend:**
```bash
# Windows
start-backend.bat

# Mac/Linux
./start-backend.sh
```

**Terminal 2 — Frontend:**
```bash
# Windows
start-frontend.bat

# Mac/Linux
./start-frontend.sh
```

### Step 5: Open the App
Navigate to **http://localhost:3000**

---

## Using the App

### As a Photographer (Admin)

1. Go to **Upload** page
2. Create an event (e.g. "College Fest 2025")
3. Drag & drop hundreds of photos — or click to select
4. Click **Upload Photos**
5. Photos upload to Cloudinary; face detection runs in the background

**Tip:** Check the **Admin** page to see processing status. The `face_count` column shows how many faces were found in each photo.

### As a Student

1. Go to **Find Me** page
2. Upload a clear selfie (or use your camera)
3. Adjust sensitivity slider if needed
4. Click **Find My Photos**
5. All matching event photos appear in the gallery
6. Download individual photos or all at once

---

## API Reference

All endpoints are at `http://localhost:8000`

Interactive API docs: **http://localhost:8000/docs**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload/photos` | Bulk upload photos (multipart) |
| POST | `/api/upload/event` | Create a new event |
| GET | `/api/upload/events` | List all events |
| POST | `/api/search/face` | Search by selfie (multipart) |
| GET | `/api/admin/stats` | System statistics |
| GET | `/api/admin/photos` | List photos with pagination |
| DELETE | `/api/admin/photo/{id}` | Delete a photo |

---

## Troubleshooting

### dlib / face_recognition won't install on Windows

Option A — Use Python 3.10 and install build tools:
1. Download [Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. Select "Desktop development with C++"
3. Then: `pip install cmake dlib face_recognition`

Option B — Pre-built wheel (Python 3.10 only):
```bash
pip install https://github.com/jloh02/dlib/releases/download/v19.22/dlib-19.22.99-cp310-cp310-win_amd64.whl
pip install face_recognition
```

### Face recognition is slow
- The HOG model (default) is fast and runs on CPU
- For more accuracy, change `model="hog"` to `model="cnn"` in `face_service.py` (requires GPU/CUDA)
- Large images are automatically resized to 1200px max before processing

### No faces found in uploaded photos
- Check backend logs for errors
- Ensure photos have visible, well-lit faces
- Very small faces (< 80px) may not be detected
- Check `/api/admin/photos` — the `processed` column should be `1`

### Search finds wrong people (false positives)
- Lower the tolerance slider in the Search page (or reduce from 0.5 to 0.4 in code)
- Default tolerance: 0.5 (lower = stricter matching)

### "No face detected in selfie" error
- Use a well-lit photo with your face clearly visible
- Avoid sunglasses, masks, or heavy shadows
- The system picks the largest face if multiple people are in the selfie

---

## Upgrading the Database

The default is SQLite (file: `facevent.db`) — perfect for development and small events.

For production (thousands of photos), switch to **Supabase/PostgreSQL**:

1. Install: `pip install asyncpg databases`
2. Update `DATABASE_URL` in `.env`
3. Replace `aiosqlite` calls in `database.py` with `databases` library

For very large datasets (millions of faces), add **FAISS** for fast vector search:
```bash
pip install faiss-cpu
```
Then replace the linear search in `face_service.py:compare_embeddings` with a FAISS index.

---

## Deployment

### Backend → Render

1. Push `backend/` to GitHub
2. Create new Web Service on [render.com](https://render.com)
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables (Cloudinary keys)

### Frontend → Vercel

1. Push `frontend/` to GitHub
2. Import on [vercel.com](https://vercel.com)
3. Set `VITE_API_URL` to your Render backend URL
4. Deploy

---

## Privacy & Security Notes

- Face embeddings are numerical vectors — not images. They cannot reconstruct a person's face.
- Add authentication (JWT/sessions) before deploying publicly. The admin routes currently have no auth.
- Consider adding a consent checkbox before students can search.
- Delete embeddings and photos after the event if not needed.
- For GDPR compliance, provide a way for students to request their data be deleted.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, React Router |
| Backend | Python 3.10+, FastAPI, Uvicorn |
| Face AI | face_recognition (dlib), OpenCV |
| Storage | Cloudinary (CDN + API) |
| Database | SQLite → upgradeable to PostgreSQL/Supabase |
| Deployment | Vercel (frontend) + Render (backend) |
