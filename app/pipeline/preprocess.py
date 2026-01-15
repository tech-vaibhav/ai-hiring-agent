import pdfplumber
import re
from typing import Optional

def extract_text_from_pdf(file_path: str) -> Optional[str]:
    """
    Extract text from a PDF and return cleaned plain text.
    Returns None if extraction fails.
    """
    try:
        pages_text = []

        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages_text.append(text)

        if not pages_text:
            return None

        raw_text = "\n".join(pages_text)
        return clean_text(raw_text)

    except Exception as e:
        print(f"[ERROR] Failed to extract PDF text: {e}")
        return None
    
def clean_text(text: str) -> str:
    """
    Normalize and clean extracted text for LLM consumption.
    """
    # Replace multiple spaces/tabs with single space
    text = re.sub(r"[ \t]+", " ", text)

    # Normalize multiple newlines
    text = re.sub(r"\n\s*\n", "\n\n", text)

    # Replace common bullet symbols
    text = re.sub(r"[•◦▪■●]", "-", text)

    # Remove trailing spaces
    return text.strip()