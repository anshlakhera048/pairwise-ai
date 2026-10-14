"""Vercel serverless entrypoint: adapts the FastAPI app to AWS Lambda via Mangum.

The backend Vercel project must have its Root Directory set to `backend/`.
`vercel.json` rewrites /api/* here; the original request path is preserved,
so the FastAPI routes (all under /api) match unchanged.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mangum import Mangum  # noqa: E402

from app.main import app  # noqa: E402

handler = Mangum(app)
