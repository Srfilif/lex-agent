#!/usr/bin/env python3
"""Humo Día 0 — Meta Model API (Q1-Q3). Solo stdlib, sin dependencias.

Lee la key de (en orden): $META_API_KEY, $META_MODEL_API_KEY, o archivo .env
en la raíz (línea META_API_KEY=...). Nunca imprime la key completa.

Pruebas:
  1. GET /models (Q2: modelos habilitados)
  2. POST /chat/completions simple (razonamiento + JSON)
  3. POST /chat/completions con tools (Q3: function calling)
  4. POST /embeddings (Q1: ¿existe?)

Uso:
  python tests/smoke/smoke_meta_api.py
  python tests/smoke/smoke_meta_api.py --base-url https://api.meta.ai/v1 --model muse-spark-1.3
"""
import argparse
import json
import os
import sys
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOTENV = os.path.join(ROOT, ".env")


def load_dotenv():
    if not os.path.exists(DOTENV):
        return
    with open(DOTENV, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k and v and k not in os.environ:
                os.environ[k] = v


def mask(key):
    if not key:
        return "(vacía)"
    if len(key) <= 8:
        return "***"
    return key[:4] + "..." + key[-4:]


_last_headers = {}

def req(method, url, key, body=None, timeout=60):
    global _last_headers
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            _last_headers = {k.lower(): v for k, v in resp.headers.items()}
            raw = resp.read().decode("utf-8", "replace")
            try:
                return resp.status, json.loads(raw)
            except json.JSONDecodeError:
                return resp.status, {"_raw": raw[:2000]}
    except urllib.error.HTTPError as e:
        try:
            _last_headers = {k.lower(): v for k, v in e.headers.items()}
        except Exception:
            _last_headers = {}
        raw = e.read().decode("utf-8", "replace")[:2000]
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"_raw": raw}
    except Exception as e:
        _last_headers = {}
        return -1, {"_error": f"{type(e).__name__}: {e}"}


def print_rate_headers():
    interesting = {k: v for k, v in _last_headers.items()
                   if any(t in k for t in ("rate", "limit", "remain", "quota", "balance", "credit"))}
    if interesting:
        for k, v in interesting.items():
            print(f"   header {k}: {v}")
    else:
        print("   (sin headers de rate-limit/cuota)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default=os.environ.get("META_BASE_URL", "https://api.meta.ai/v1"))
    ap.add_argument("--model", default=os.environ.get("META_MODEL", "muse-spark-1.3"))
    args = ap.parse_args()
    load_dotenv()
    key = os.environ.get("META_API_KEY") or os.environ.get("META_MODEL_API_KEY", "")
    base = args.base_url.rstrip("/")

    print(f"Base URL: {base}")
    print(f"Modelo:   {args.model}")
    print(f"Key:      {mask(key)} (fuente: {'env/.env' if key else 'NO ENCONTRADA'})")
    if not key:
        print("\nFalta la key. Crea un archivo .env en la raíz con:\n  META_API_KEY=tu-key-aqui\n(y no lo commitees).")
        return 2

    results = {}

    # 1. Modelos (Q2)
    print("\n[1/5] GET /models ...")
    s, b = req("GET", f"{base}/models", key)
    results["models"] = (s, b)
    print(f"  HTTP {s}")
    if s == 200 and isinstance(b, dict) and "data" in b:
        for m in b["data"][:20]:
            print(f"   - {m.get('id')}")
    else:
        print(f"   {json.dumps(b)[:500]}")
    print_rate_headers()

    # 2. Chat simple
    print("\n[2/5] POST /chat/completions (simple) ...")
    s, b = req("POST", f"{base}/chat/completions", key, {
        "model": args.model,
        "messages": [{"role": "user", "content": "Responde solo con el JSON {\"ok\": true}."}],
        "max_tokens": 500,
    })
    results["chat"] = (s, b)
    print(f"  HTTP {s}")
    try:
        print(f"   {b['choices'][0]['message']['content'][:300]}")
        print(f"   usage: {b.get('usage')}")
    except (KeyError, IndexError, TypeError):
        print(f"   {json.dumps(b)[:500]}")

    # 3. Tool calling (Q3) — auto
    tools = [{
        "type": "function",
        "function": {
            "name": "buscar_normas",
            "description": "Busca fragmentos de normas jurídicas",
            "parameters": {"type": "object", "properties": {
                "query": {"type": "string"}, "top_k": {"type": "integer"}},
                "required": ["query"]},
        },
    }]
    print("\n[3/5] POST /chat/completions (tools auto) ...")
    s, b = req("POST", f"{base}/chat/completions", key, {
        "model": args.model,
        "messages": [{"role": "user", "content": "Usa OBLIGATORIAMENTE la herramienta buscar_normas con query='artículo 24 Ley 80 de 1993' para responder qué dice ese artículo."}],
        "tools": tools,
        "tool_choice": "auto",
        "max_tokens": 1000,
    })
    results["tools"] = (s, b)
    print(f"  HTTP {s}")
    try:
        msg = b["choices"][0]["message"]
        if msg.get("tool_calls"):
            print(f"   TOOL CALL: {json.dumps(msg['tool_calls'])[:400]}")
        else:
            print(f"   sin tool_calls, contenido: {str(msg.get('content'))[:300]}")
    except (KeyError, IndexError, TypeError):
        print(f"   {json.dumps(b)[:500]}")

    # 3b. Tool calling forzado
    print("\n[4/5] POST /chat/completions (tool_choice forzado) ...")
    s2, b2 = req("POST", f"{base}/chat/completions", key, {
        "model": args.model,
        "messages": [{"role": "user", "content": "Busca el artículo 24 de la Ley 80 de 1993."}],
        "tools": tools,
        "tool_choice": {"type": "function", "function": {"name": "buscar_normas"}},
        "max_tokens": 1000,
    })
    results["tools_forced"] = (s2, b2)
    print(f"  HTTP {s2}")
    try:
        msg = b2["choices"][0]["message"]
        if msg.get("tool_calls"):
            print(f"   TOOL CALL: {json.dumps(msg['tool_calls'])[:400]}")
        else:
            print(f"   sin tool_calls, contenido: {str(msg.get('content'))[:300]}")
    except (KeyError, IndexError, TypeError):
        print(f"   {json.dumps(b2)[:500]}")

    # 4. Embeddings (Q1)
    print("\n[5/5] POST /embeddings ...")
    s, b = req("POST", f"{base}/embeddings", key, {
        "model": os.environ.get("META_EMBED_MODEL", args.model),
        "input": "Ley 80 de 1993, contratación estatal",
    })
    results["embeddings"] = (s, b)
    print(f"  HTTP {s}")
    try:
        print(f"   dims: {len(b['data'][0]['embedding'])}, usage: {b.get('usage')}")
    except (KeyError, IndexError, TypeError):
        print(f"   {json.dumps(b)[:500]}")

    # Resumen
    print("\n--- RESUMEN ---")
    ok = lambda k: results[k][0] == 200
    print(f"Q2 modelos listados:     {'SI' if ok('models') else 'NO'} ({results['models'][0]})")
    print(f"Chat básico:             {'SI' if ok('chat') else 'NO'} ({results['chat'][0]})")
    tc = results["tools"][0] == 200 and "tool_calls" in json.dumps(results["tools"][1])
    tcf = results["tools_forced"][0] == 200 and "tool_calls" in json.dumps(results["tools_forced"][1])
    print(f"Q3 tool calling:         {'SI' if (tc or tcf) else 'NO'} (auto={results['tools'][0]}/{'SI' if tc else 'NO'}, forzado={results['tools_forced'][0]}/{'SI' if tcf else 'NO'})")
    print(f"Q1 embeddings:           {'SI' if ok('embeddings') else 'NO -> usar modelo abierto'} ({results['embeddings'][0]})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
