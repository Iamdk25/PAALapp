import os
import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

load_dotenv()

# Example: https://clerk.YOUR_DOMAIN.com/.well-known/jwks.json
CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL")

security = HTTPBearer()

def get_clerk_jwks():
    """Fetch the JSON Web Key Set from your Clerk Frontend API."""
    if not CLERK_JWKS_URL:
        # Fallback for local testing if env var isn't set yet
        print("⚠️ CLERK_JWKS_URL not set in .env. Skipping real auth for hackathon testing.")
        return None
    try:
        response = httpx.get(CLERK_JWKS_URL)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error fetching JWKS: {e}")
        return None

def verify_token(token: str):
    """Decode and verify the Clerk JWT."""
    if not CLERK_JWKS_URL:
        # Mock user for local testing if keys are missing
        return "user_mock_123"

    jwks = get_clerk_jwks()
    if not jwks:
        raise HTTPException(status_code=500, detail="Could not retrieve JWKS.")
    
    try:
        # Get the unverified header to find the Key ID (kid)
        unverified_header = jwt.get_unverified_header(token)
        rsa_key = {}
        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }
                break

        if rsa_key:
            # Reconstruct the public key from the JWKS
            public_key = jwt.algorithms.RSAAlgorithm.from_jwk(rsa_key)
            # Verify the token
            # Note: You should verify the "aud" (audience) or "iss" (issuer) in a real prod app
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                options={"verify_aud": False} 
            )
            return payload.get("sub") # 'sub' is the Clerk user_id
        else:
            raise HTTPException(status_code=401, detail="Invalid token kid.")
            
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """FastAPI dependency to protect endpoints and return the Clerk User ID."""
    token = credentials.credentials
    user_id = verify_token(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated",
        )
    return user_id
