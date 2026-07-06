"""
fetch.py — Download and parse CanadaBuys open tender notices CSV.
"""
import csv
import io
import json
from pathlib import Path

import requests

OPEN_CSV = "https://canadabuys.canada.ca/opendata/pub/openTenderNotice-ouvertAvisAppelOffres.csv"

HEADERS = {
    "User-Agent": "TenderPipeline/1.0 (procurement intelligence; contact: fahadgondal2001@gmail.com)",
}

# Map friendly keys → CSV column names
FIELD_MAP = {
    "title":           "title-titre-eng",
    "ref":             "referenceNumber-numeroReference",
    "sol":             "solicitationNumber-numeroSollicitation",
    "published":       "publicationDate-datePublication",
    "closes":          "tenderClosingDate-appelOffresDateCloture",
    "gsin":            "gsinDescription-nibsDescription-eng",
    "unspsc":          "unspscDescription-eng",
    "category":        "procurementCategory-categorieApprovisionnement",
    "notice_type":     "noticeType-avisType-eng",
    "method":          "procurementMethod-methodeApprovisionnement-eng",
    "selection":       "selectionCriteria-criteresSelection-eng",
    "limited_reason":  "limitedTenderingReason-raisonAppelOffresLimite-eng",
    "department":      "contractingEntityName-nomEntitContractante-eng",
    "dept_city":       "contractingEntityAddressCity-entiteContractanteAdresseVille-eng",
    "dept_province":   "contractingEntityAddressProvince-entiteContractanteAdresseProvince-eng",
    "regions":         "regionsOfOpportunity-regionAppelOffres-eng",
    "delivery":        "regionsOfDelivery-regionsLivraison-eng",
    "contact_email":   "contactInfoEmail-informationsContactCourriel",
    "contact_name":    "contactInfoName-informationsContactNom",
    "url":             "noticeURL-URLavis-eng",
    "description":     "tenderDescription-descriptionAppelOffres-eng",
}


def fetch_open_tenders() -> list[dict]:
    resp = requests.get(OPEN_CSV, headers=HEADERS, timeout=120)
    resp.raise_for_status()
    text = resp.content.decode("utf-8-sig")  # strip BOM if present
    reader = csv.DictReader(io.StringIO(text))
    tenders = []
    for row in reader:
        t = {k: (row.get(v) or "").strip() for k, v in FIELD_MAP.items()}
        if t["ref"] and t["title"]:
            tenders.append(t)
    return tenders


def load_seen(path: Path) -> set[str]:
    if path.exists():
        return set(json.loads(path.read_text()))
    return set()


def save_seen(path: Path, seen: set[str]):
    path.write_text(json.dumps(sorted(seen), indent=2))


def filter_new(tenders: list[dict], seen: set[str]) -> list[dict]:
    return [t for t in tenders if t["ref"] not in seen]
