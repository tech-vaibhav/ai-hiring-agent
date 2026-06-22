from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_BUCKET

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            raise RuntimeError("Supabase env vars not set")
        _client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return _client


def upload_pdf_bytes(
    pdf_bytes: bytes,
    object_prefix: str,
    filename: str
) -> str:
    """
    Upload PDF bytes to Supabase Storage.
    Returns object path relative to bucket.
    """
    client = get_client()

    # filename MUST already include .pdf
    object_path = f"{object_prefix}/{filename}"

    client.storage.from_(SUPABASE_BUCKET).upload(
        object_path,
        pdf_bytes,
        file_options={"content-type": "application/pdf"},
    )

    return object_path


def download_object(object_path: str) -> bytes:
    """
    Download a private object from Supabase Storage as bytes.
    """
    client = get_client()
    data = client.storage.from_(SUPABASE_BUCKET).download(object_path)

    if not data:
        raise RuntimeError("Failed to download object from Supabase")

    return data


def delete_object(object_path: str) -> None:
    """
    Delete an object from Supabase Storage.
    """
    client = get_client()
    client.storage.from_(SUPABASE_BUCKET).remove([object_path])
