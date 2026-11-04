#!/usr/bin/env python3
"""Goldens de contratos HTTP (Bloque C). Deterministas; normaliza volátiles.
Uso: python tests/smoke/contract_check.py --record   (congela conducta actual)
     python tests/smoke/contract_check.py --check    (compara; falla si difiere)
"""
import json, sys, urllib.request, urllib.error
from pathlib import Path

API = "http://localhost:3000"
GOLDEN = str(Path(__file__).with_name("goldens.json"))
DROP_KEYS = {"ms", "time", "db", "fecha_consulta"}

def get(path):
    try:
        with urllib.request.urlopen(API + path, timeout=60) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "null")

def norm(obj):
    if isinstance(obj, dict):
        # totals del gateway es un contador volátil: presencia sí, valor no
        if "totals" in obj and "keyConfigured" in obj:
            obj = {**obj, "totals": "VOLATIL"}
        return {k: norm(v) for k, v in obj.items() if k not in DROP_KEYS}
    if isinstance(obj, list):
        return [norm(v) for v in obj]
    return obj

def collect():
    cases = {}
    cases["health"] = get("/health")
    cases["ready"] = get("/ready")
    cases["search_q"] = get("/search?q=principio%20de%20transparencia&top_k=2")
    cases["search_struct"] = get("/search?q=articulo%2024%20de%20la%20ley%2080&top_k=2")
    cases["search_empty"] = get("/search")
    cases["search_cov"] = get("/search/documentos")
    cases["search_filtros"] = get("/search?q=transparencia&jurisdiccion=CO&tema=contratacion_estatal&top_k=2")
    cases["secop_entidad"] = get("/secop/contracts?entidad=medellin&limit=2")
    cases["secop_objeto"] = get("/secop/contracts?objeto=software&valor_min=100000000&limit=1")
    return cases

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "--check"
    if mode == "--record":
        cases = collect()
        cid = cases["search_q"][1]["hits"][0]["chunk_id"]
        cases["chunk_ok"] = get(f"/search/chunk/{cid}")
        cases["chunk_bad"] = get("/search/chunk/no-es-uuid")
        cases["_chunk_id"] = cid
        json.dump(cases, open(GOLDEN, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"goldens grabados ({len(cases)} casos) en {GOLDEN}")
        return
    gold = json.load(open(GOLDEN, encoding="utf-8"))
    cases = collect()
    cases["chunk_ok"] = get(f"/search/chunk/{gold['_chunk_id']}")
    cases["chunk_bad"] = get("/search/chunk/no-es-uuid")
    fails = 0
    for name, (st, body) in cases.items():
        gst, gbody = gold[name]
        # presencia de volátiles
        for k in DROP_KEYS:
            if isinstance(body, dict) and k in (gbody if isinstance(gbody, dict) else {}):
                assert k in body, f"{name}: falta volátil {k}"
        if st != gst or norm(body) != norm(gbody):
            print(f"DIFIERE {name}: status {st} vs {gst}")
            fails += 1
        else:
            print(f"igual {name}")
    if fails:
        print(f"{fails} contratos difieren")
        sys.exit(1)
    print("contratos intactos")

if __name__ == "__main__":
    main()
