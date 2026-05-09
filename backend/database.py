import aiosqlite
import json
import os
from typing import List, Optional, Dict, Any
import numpy as np

DB_PATH = os.getenv("DB_PATH", "facevent.db")

async def init_db():
    """Initialize the database and create tables if they don't exist."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER,
                cloudinary_url TEXT NOT NULL,
                cloudinary_public_id TEXT NOT NULL UNIQUE,
                original_filename TEXT,
                face_count INTEGER DEFAULT 0,
                processed INTEGER DEFAULT 0,
                is_hidden INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (event_id) REFERENCES events(id)
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS face_embeddings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                photo_id INTEGER NOT NULL,
                embedding TEXT NOT NULL,
                face_location TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (photo_id) REFERENCES photos(id)
            )
        """)
        
        # Add is_hidden column if it doesn't exist (migration for existing databases)
        try:
            cursor = await db.execute("PRAGMA table_info(photos)")
            columns = await cursor.fetchall()
            column_names = [col[1] for col in columns]
            if 'is_hidden' not in column_names:
                print("🔧 Migrating: Adding is_hidden column to photos table...")
                await db.execute("ALTER TABLE photos ADD COLUMN is_hidden INTEGER DEFAULT 0")
                await db.commit()
                print("✅ Migration complete: is_hidden column added")
        except Exception as e:
            print(f"⚠️  Migration check failed: {e}")
        
        # Default event
        await db.execute("""
            INSERT OR IGNORE INTO events (id, name, description) 
            VALUES (1, 'General Event', 'Default event for uploaded photos')
        """)
        await db.commit()

async def check_duplicate_filenames(filenames: List[str], event_id: Optional[int] = None) -> Dict[str, Dict]:
    """
    Check which filenames already exist in the database.
    Returns a dict: { filename: { photo_id, cloudinary_url, event_name, created_at } }
    Only matches that exist are included in the result.
    """
    if not filenames:
        return {}

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        placeholders = ",".join("?" for _ in filenames)
        if event_id:
            query = f"""
                SELECT p.id, p.original_filename, p.cloudinary_url, p.created_at,
                       e.name as event_name
                FROM photos p JOIN events e ON p.event_id = e.id
                WHERE p.original_filename IN ({placeholders}) AND p.event_id = ?
            """
            params = (*filenames, event_id)
        else:
            query = f"""
                SELECT p.id, p.original_filename, p.cloudinary_url, p.created_at,
                       e.name as event_name
                FROM photos p JOIN events e ON p.event_id = e.id
                WHERE p.original_filename IN ({placeholders})
            """
            params = tuple(filenames)

        async with db.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            result = {}
            for row in rows:
                d = dict(row)
                result[d["original_filename"]] = {
                    "photo_id": d["id"],
                    "cloudinary_url": d["cloudinary_url"],
                    "event_name": d["event_name"],
                    "created_at": d["created_at"],
                }
            return result

async def insert_event(name: str, description: str = "") -> int:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "INSERT INTO events (name, description) VALUES (?, ?)",
            (name, description)
        )
        await db.commit()
        return cursor.lastrowid

async def get_events() -> List[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT e.*, COUNT(p.id) as photo_count 
            FROM events e 
            LEFT JOIN photos p ON p.event_id = e.id 
            GROUP BY e.id 
            ORDER BY e.created_at DESC
        """) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

async def insert_photo(
    event_id: int,
    cloudinary_url: str,
    cloudinary_public_id: str,
    original_filename: str
) -> int:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            """INSERT OR IGNORE INTO photos 
               (event_id, cloudinary_url, cloudinary_public_id, original_filename)
               VALUES (?, ?, ?, ?)""",
            (event_id, cloudinary_url, cloudinary_public_id, original_filename)
        )
        await db.commit()
        if cursor.lastrowid == 0:
            async with db.execute(
                "SELECT id FROM photos WHERE cloudinary_public_id = ?",
                (cloudinary_public_id,)
            ) as c:
                row = await c.fetchone()
                return row[0] if row else -1
        return cursor.lastrowid

async def update_photo_processed(photo_id: int, face_count: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE photos SET processed = 1, face_count = ? WHERE id = ?",
            (face_count, photo_id)
        )
        await db.commit()

async def insert_face_embedding(
    photo_id: int,
    embedding: List[float],
    face_location: Optional[tuple] = None
):
    embedding_json = json.dumps(embedding)
    location_json = json.dumps(face_location) if face_location else None
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO face_embeddings (photo_id, embedding, face_location) VALUES (?, ?, ?)",
            (photo_id, embedding_json, location_json)
        )
        await db.commit()

async def get_all_embeddings() -> List[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT fe.id, fe.embedding, fe.face_location,
                   p.id as photo_id, p.cloudinary_url, p.original_filename,
                   e.name as event_name
            FROM face_embeddings fe
            JOIN photos p ON fe.photo_id = p.id
            JOIN events e ON p.event_id = e.id
        """) as cursor:
            rows = await cursor.fetchall()
            result = []
            for row in rows:
                d = dict(row)
                d['embedding'] = json.loads(d['embedding'])
                result.append(d)
            return result

async def get_stats() -> Dict:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT COUNT(*) FROM photos") as c:
            total_photos = (await c.fetchone())[0]
        async with db.execute("SELECT COUNT(*) FROM photos WHERE processed=1") as c:
            processed_photos = (await c.fetchone())[0]
        async with db.execute("SELECT COUNT(*) FROM face_embeddings") as c:
            total_faces = (await c.fetchone())[0]
        async with db.execute("SELECT COUNT(*) FROM events") as c:
            total_events = (await c.fetchone())[0]
        return {
            "total_photos": total_photos,
            "processed_photos": processed_photos,
            "total_faces": total_faces,
            "total_events": total_events
        }

async def get_photos(event_id: Optional[int] = None, limit: int = 50, offset: int = 0) -> List[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if event_id:
            query = """
                SELECT p.*, e.name as event_name 
                FROM photos p JOIN events e ON p.event_id = e.id
                WHERE p.event_id = ?
                ORDER BY p.created_at DESC LIMIT ? OFFSET ?
            """
            params = (event_id, limit, offset)
        else:
            query = """
                SELECT p.*, e.name as event_name 
                FROM photos p JOIN events e ON p.event_id = e.id
                ORDER BY p.created_at DESC LIMIT ? OFFSET ?
            """
            params = (limit, offset)
        async with db.execute(query, params) as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

async def delete_photo(photo_id: int) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM face_embeddings WHERE photo_id = ?", (photo_id,))
        cursor = await db.execute("DELETE FROM photos WHERE id = ?", (photo_id,))
        await db.commit()
        return cursor.rowcount > 0

async def toggle_photo_visibility(photo_id: int) -> bool:
    """Toggle the visibility of a photo (hidden/unhidden)."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE photos SET is_hidden = 1 - is_hidden WHERE id = ?",
            (photo_id,)
        )
        await db.commit()
        async with db.execute("SELECT is_hidden FROM photos WHERE id = ?", (photo_id,)) as cursor:
            row = await cursor.fetchone()
            return bool(row[0]) if row else False

async def get_public_photos(limit: int = 50, offset: int = 0) -> List[Dict]:
    """Get only non-hidden photos for public display."""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            query = """
                SELECT p.id, p.cloudinary_url, p.original_filename, 
                       p.face_count, p.created_at, e.name as event_name
                FROM photos p 
                JOIN events e ON p.event_id = e.id
                WHERE p.is_hidden = 0 AND p.processed = 1
                ORDER BY p.created_at DESC 
                LIMIT ? OFFSET ?
            """
            async with db.execute(query, (limit, offset)) as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]
    except Exception as e:
        print(f"Error in get_public_photos: {e}")
        raise

async def get_public_photos_count() -> int:
    """Get count of non-hidden photos."""
    try:
        async with aiosqlite.connect(DB_PATH) as db:
            async with db.execute("SELECT COUNT(*) FROM photos WHERE is_hidden = 0 AND processed = 1") as cursor:
                row = await cursor.fetchone()
                return row[0] if row else 0
    except Exception as e:
        print(f"Error in get_public_photos_count: {e}")
        raise