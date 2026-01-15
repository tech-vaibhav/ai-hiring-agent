import os
from supabase import create_client, Client
from uuid import uuid4
from app.config import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_BUCKET

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            raise RuntimeError("Supabase env vars not set")
        _client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return _client


def upload_pdf_bytes(pdf_bytes: bytes, object_prefix: str) -> str:
    """
    Upload PDF bytes to Supabase Storage (private bucket).
    Returns the object path (not public URL).
    """
    client = get_client()
    object_name = f"{object_prefix}/{uuid4().hex}.pdf"

    res = client.storage.from_(SUPABASE_BUCKET).upload(
        path=object_name,
        file=pdf_bytes,
        file_options={"content-type": "application/pdf"},
    )

    if res.get("error"):
        raise RuntimeError(f"Supabase upload failed: {res['error']}")

    return object_name


def create_signed_url(object_path: str, expires_in: int = 300) -> str:
    """
    Create a short-lived signed URL for private access.
    """
    client = get_client()
    res = client.storage.from_(SUPABASE_BUCKET).create_signed_url(
        path=object_path,
        expires_in=expires_in,
    )
    if res.get("error"):
        raise RuntimeError(f"Signed URL failed: {res['error']}")
    return res["signedURL"]


def delete_object(object_path: str) -> None:
    client = get_client()
    res = client.storage.from_(SUPABASE_BUCKET).remove([object_path])
    if res.get("error"):
        raise RuntimeError(f"Delete failed: {res['error']}")
