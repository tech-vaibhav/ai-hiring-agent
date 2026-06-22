import os
import hashlib
import hmac
import secrets
import random
from datetime import datetime, timedelta
import jwt
import requests
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# JWT Configurations
JWT_SECRET = os.getenv("JWT_SECRET", "ai_hiring_agent_secret_key_987654321")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_MINUTES = 120

# SMTP Configurations
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = os.getenv("SMTP_PORT")  # e.g., 587
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")


# ==========================================
# PASSWORD SECURITY
# ==========================================

def hash_password(password: str) -> str:
    """
    Generates a secure SHA-256 PBKDF2 hash of a password with a random salt.
    Format: salt$hash_hex
    """
    salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000
    )
    return f"{salt}${pw_hash.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    """
    Verifies a password against a PBKDF2 hash using timing-safe comparison.
    """
    try:
        salt, stored_hash = hashed.split("$")
        pw_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            100000
        )
        return hmac.compare_digest(pw_hash.hex(), stored_hash)
    except Exception:
        return False


# ==========================================
# JWT SESSION TOKENS
# ==========================================

def create_access_token(data: dict) -> str:
    """
    Generates a JWT access token valid for session authentication.
    """
    payload = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=JWT_EXPIRY_MINUTES)
    payload.update({"exp": expire})
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_access_token(token: str) -> dict:
    """
    Verifies and decodes a JWT access token. Returns decoded dict, or None if invalid.
    """
    try:
        decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return decoded
    except Exception:
        return None


# ==========================================
# GOOGLE ID TOKEN AUTHENTICATION
# ==========================================

def verify_google_token(id_token: str) -> dict:
    """
    Validates a Google OAuth2 ID Token using Google's TokenInfo API.
    Returns profile information if valid, or None if validation fails.
    """
    try:
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            payload = response.json()
            return {
                "google_id": payload.get("sub"),
                "email_id": payload.get("email"),
                "first_name": payload.get("given_name", ""),
                "last_name": payload.get("family_name", "")
            }
        else:
            print(f"[ERROR] Google tokeninfo returned code {response.status_code}: {response.text}")
            return None
    except Exception as e:
        print(f"[ERROR] Google token verification crashed: {e}")
        return None


# ==========================================
# OTP GENERATION & SMTP EMAIL DISPATCH
# ==========================================

def generate_otp() -> str:
    """
    Generates a random 4-digit code.
    """
    return f"{random.randint(1000, 9999)}"


def send_otp_email(email_id: str, otp_code: str) -> bool:
    """
    Sends the 4-digit OTP to the user's email.
    Falls back to console print if SMTP configs are missing in env.
    """
    subject = "AI Hiring Agent - Verification Code"
    body = f"""
    Hello,

    Your 4-digit verification code is: {otp_code}

    This code is valid for 5 minutes.

    Regards,
    AI Hiring Agent Team
    """

    # Check if SMTP parameters are set
    if not all([SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD]):
        print(f"\n[DEV LOG] Verification OTP for {email_id}: {otp_code}\n")
        return True

    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_USER
        msg["To"] = email_id
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        port = int(SMTP_PORT)
        # Port 465 uses SSL, port 587 uses STARTTLS
        if port == 465:
            server = smtplib.SMTP_SSL(SMTP_HOST, port)
        else:
            server = smtplib.SMTP(SMTP_HOST, port)
            server.starttls()

        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, email_id, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"[ERROR] Failed to send email via SMTP: {e}")
        # Print to logs as fallback
        print(f"\n[FALLBACK DEV LOG] Verification OTP for {email_id}: {otp_code}\n")
        return False
