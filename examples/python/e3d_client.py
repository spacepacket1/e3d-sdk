"""Minimal E3D API helper for Python examples.

This keeps the examples dependency-free by using urllib from the standard
library instead of an external HTTP client.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional
from urllib import parse, request, error


@dataclass
class E3DClient:
    base_url: str = os.getenv("E3D_BASE_URL", "https://e3d.ai/apitest")
    api_key: Optional[str] = os.getenv("E3D_API_KEY")
    api_key_header: str = os.getenv("E3D_API_KEY_HEADER", "x-api-key")
    timeout: int = int(os.getenv("E3D_TIMEOUT_MS", "0") or 0) // 1000 or 30

    def _build_url(self, path: str, query: Optional[Dict[str, Any]] = None) -> str:
        base = self.base_url.rstrip("/")
        clean_path = path if path.startswith("/") else f"/{path}"
        url = f"{base}{clean_path}"
        if query:
            filtered = []
            for key, value in query.items():
                if value is None:
                    continue
                if isinstance(value, (list, tuple, set)):
                    for item in value:
                        if item is None:
                            continue
                        filtered.append((key, str(item)))
                    continue
                filtered.append((key, str(value)))
            if filtered:
                url = f"{url}?{parse.urlencode(filtered)}"
        return url

    def request(self, method: str, path: str, *, query: Optional[Dict[str, Any]] = None, body: Optional[Any] = None) -> Any:
        url = self._build_url(path, query)
        headers = {"Accept": "application/json"}
        if self.api_key:
            headers[self.api_key_header] = self.api_key

        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8") if not isinstance(body, (bytes, bytearray)) else body

        req = request.Request(url, data=data, headers=headers, method=method.upper())
        try:
            with request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode("utf-8")
                if not raw:
                    return None
                content_type = resp.headers.get("Content-Type", "")
                if "application/json" in content_type:
                    return json.loads(raw)
                try:
                    return json.loads(raw)
                except json.JSONDecodeError:
                    return raw
        except error.HTTPError as exc:
            payload = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"HTTP {exc.code} for {url}: {payload}") from exc
        except Exception as exc:
            raise RuntimeError(f"Request failed for {url}: {exc}") from exc

    def get(self, path: str, *, query: Optional[Dict[str, Any]] = None) -> Any:
        return self.request("GET", path, query=query)

    def post(self, path: str, *, query: Optional[Dict[str, Any]] = None, body: Optional[Any] = None) -> Any:
        return self.request("POST", path, query=query, body=body)
