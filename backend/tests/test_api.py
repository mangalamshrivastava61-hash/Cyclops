"""End-to-end behaviour of the API against a fresh seeded database."""


def test_health_reports_no_ml(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert "no ML" in body["forecastProvider"]
    assert body["records"]["decisions"] == 5


def test_state_starts_from_the_seed(client):
    s = client.get("/api/state").json()
    assert s["world"]["today"] == "2026-09-26"
    assert s["actions"]["18513"] == {"status": "pending", "quantity": 127, "reason": None, "note": None, "at": None, "by": None}
    assert s["actions"]["18509"]["status"] == "modified" and s["actions"]["18509"]["quantity"] == 72
    assert s["simulation"] == {"circuit": "clear", "probesPreview": False}
    assert s["authority"]["1842"]["level"] == 2


def test_bundle_has_everything_a_page_needs(client):
    b = client.get("/api/decisions/18513").json()
    assert b["decision"]["recommendedOrder"] == 127 and b["decision"]["status"] == "pending"
    assert b["product"]["name"] == "Aero Runner 01"
    assert b["forecast"]["p50"] == 212 and len(b["forecast"]["history"]) == 28
    assert b["evidence"]["authorityNow"]["level"] == 2
    assert b["policy"]["onHand"] == 82
    assert b["canStress"] is True and b["hasEvidence"] is True


def test_unknown_records_are_404(client):
    for url in ["/api/decisions/99999", "/api/evidence/18509", "/api/authority/9999", "/api/replays/R-0", "/api/ledger/1"]:
        assert client.get(url).status_code == 404, url


def test_approve_writes_action_and_chained_ledger_entry(client):
    before = client.get("/api/ledger").json()
    r = client.post("/api/decisions/18513/approve")
    assert r.status_code == 200
    body = r.json()
    assert body["action"]["status"] == "approved" and body["action"]["by"] == "H. Haswani"
    entry = body["entry"]
    assert entry["seq"] == before[-1]["seq"] + 1 and entry["prevHash"] == before[-1]["hash"]
    assert entry["title"] == "Aero Runner 01 — 127 approved"

    # every page sees it
    assert client.get("/api/state").json()["actions"]["18513"]["status"] == "approved"
    order_entry = next(e for e in client.get("/api/ledger").json() if e["id"] == "18513")
    assert order_entry["chip"]["label"] == "Review · approved"
    approval = next(line for g in order_entry["receipt"] for line in g if line["label"] == "Approval")
    assert approval["value"].startswith("H. Haswani")
    assert client.get("/api/ledger/verify").json()["ok"] is True

    # cannot act twice
    again = client.post("/api/decisions/18513/approve")
    assert again.status_code == 409 and "already approved" in again.json()["detail"]


def test_modify_validates_and_records_the_override(client):
    assert client.post("/api/decisions/18513/modify", json={"quantity": 0, "reason": "LOCAL_EVENT"}).status_code == 422
    assert client.post("/api/decisions/18513/modify", json={"quantity": 130, "reason": "BECAUSE"}).status_code == 422
    assert client.post("/api/decisions/18513/modify", json={"quantity": 127, "reason": "OTHER"}).status_code == 409
    r = client.post("/api/decisions/18513/modify", json={"quantity": 133, "reason": "LOCAL_EVENT", "note": "Marathon on Sunday"})
    assert r.status_code == 200
    body = r.json()
    assert body["action"] == {"status": "modified", "quantity": 133, "reason": "LOCAL_EVENT", "note": "Marathon on Sunday", "at": body["action"]["at"], "by": "H. Haswani"}
    assert body["entry"]["eyebrow"] == "OVERRIDE · SKU 1842 · LOCAL EVENT"
    assert body["entry"]["quote"] == "Marathon on Sunday"


def test_reject_falls_back(client):
    r = client.post("/api/decisions/18513/reject", json={"reason": "Supplier cannot deliver"})
    assert r.status_code == 200 and r.json()["action"]["quantity"] == 97
    assert client.get("/api/decisions/18513").json()["decision"]["status"] == "rejected"


def test_benched_and_markdown_decisions_are_guarded(client):
    assert client.post("/api/decisions/18510/approve").status_code == 409  # benched SKU
    assert client.post("/api/decisions/18507/reject", json={"reason": "No"}).status_code == 409  # markdown
    ok = client.post("/api/decisions/18507/approve")
    assert ok.status_code == 200 and "acknowledged" in ok.json()["entry"]["title"]


def test_simulation_caps_authority(client):
    r = client.put("/api/simulation", json={"circuit": "bench"}).json()
    assert r["authority"]["1842"]["level"] == 1 and r["authority"]["1842"]["cap"] == 1
    r = client.put("/api/simulation", json={"circuit": "clear", "probesPreview": True}).json()
    assert r["authority"]["1842"]["level"] == 3
    assert client.put("/api/simulation", json={"circuit": "storm"}).status_code == 422


def test_notes_append_to_the_ledger(client):
    r = client.post("/api/ledger/notes", json={"eyebrow": "SUPPLIER CHECK · SKU 1842", "title": "Confirm lead time", "meta": "Requested by H. Haswani", "sku": "1842", "decisionId": "18513"})
    assert r.status_code == 201 and r.json()["entry"]["kind"] == "note"
    assert client.post("/api/ledger/notes", json={"eyebrow": "", "title": "x", "meta": "y"}).status_code == 422


def test_reset_restores_the_seed(client):
    client.post("/api/decisions/18513/approve")
    client.put("/api/simulation", json={"circuit": "bench"})
    s = client.post("/api/simulation/reset").json()
    assert s["actions"]["18513"]["status"] == "pending" and s["simulation"]["circuit"] == "clear"
    assert client.get("/api/ledger").json()[-1]["id"] == "18516"


def test_scenario_endpoint(client):
    r = client.post("/api/decisions/18513/scenario", json={"stress": {"leadTime": 2}}).json()
    assert r["result"]["order"] == 165 and round(r["result"]["riskIfKeep"] * 100) == 48
    assert round(r["flipLeadTime"], 1) == 5.7
    assert client.post("/api/decisions/18513/scenario", json={"stress": {"weather": 1}}).status_code == 422


def test_ask_is_grounded(client):
    a = client.post("/api/ask", json={"question": "Why did ORACLE recommend 127 units?", "askedAt": "2026-09-26T10:04:00"}).json()
    assert a["intent"] == "why" and a["about"] == "18513" and a["askedAt"] == "2026-09-26T10:04:00"
    eq = next(b for b in a["blocks"] if b["type"] == "equation")
    assert [p["value"] for p in eq["parts"]] + [eq["result"]["value"]] == ["249", "82", "40", "127"]
    assert "**168 to 262 units**" in a["blocks"][0]["text"] and "five times" in a["blocks"][0]["text"]
    assert [s["title"] for s in a["sources"]] == ["Decision #18513", "Forecast F-1842-0926", "Observability", "Probe set P-120"]

    lead = client.post("/api/ask", json={"question": "What if the lead time slips 2 days?"}).json()
    assert "==165 units==" in lead["blocks"][0]["text"] and "**5.7 days**" in lead["blocks"][1]["text"]

    assert client.post("/api/ask", json={"question": "Please approve 150 units"}).json()["intent"] == "refuse-action"
    assert client.post("/api/ask", json={"question": "Why is Slide Pro benched?"}).json()["about"] == "18510"
    none = client.post("/api/ask", json={"question": "what's the weather tomorrow"}).json()
    assert none["intent"] == "none" and none["blocks"][0]["text"] == "No record, no answer."
    assert client.post("/api/ask", json={"question": ""}).status_code == 422


def test_ask_follows_live_state(client):
    client.post("/api/decisions/18513/approve")
    a = client.post("/api/ask", json={"question": "Has it been approved?"}).json()
    assert "**approved**" in a["blocks"][0]["text"]
    client.put("/api/simulation", json={"circuit": "bench"})
    auth = client.post("/api/ask", json={"question": "When does it earn L3 again?"}).json()
    assert "L1 · Advisory" in auth["blocks"][0]["text"] and "caps it at L1" in auth["blocks"][0]["text"]
