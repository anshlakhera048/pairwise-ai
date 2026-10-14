"""OpenAI-compatible chat completions client. No key -> not configured."""
from __future__ import annotations

import json
import os

import httpx


class LLMNotConfigured(Exception):
    pass


class LLMError(Exception):
    pass


def configured() -> bool:
    return bool(os.environ.get("LLM_API_KEY", "").strip())


def _strip_fences(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        lines = t.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        t = "\n".join(lines).strip()
    return t


def _parse_json(text: str) -> dict:
    t = _strip_fences(text)
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        start, end = t.find("{"), t.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(t[start : end + 1])
        raise LLMError(f"could not parse JSON from model output: {text[:200]!r}")


def chat(system: str, user: str, json_mode: bool = False) -> str | dict:
    key = os.environ.get("LLM_API_KEY", "").strip()
    if not key:
        raise LLMNotConfigured("LLM_API_KEY is not set")
    base = os.environ.get("LLM_API_BASE", "https://api.openai.com/v1").rstrip("/")
    model = os.environ.get("LLM_MODEL", "gpt-4o-mini")
    payload: dict = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.7,
        "max_tokens": 2500,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    try:
        resp = httpx.post(
            f"{base}/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json=payload,
            timeout=60.0,
        )
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise LLMError(f"LLM request failed: {exc}")
    try:
        content = resp.json()["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, ValueError) as exc:
        raise LLMError(f"unexpected LLM response shape: {exc}")
    if json_mode:
        return _parse_json(content)
    return content
