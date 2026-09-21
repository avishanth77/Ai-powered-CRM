import os
import sqlite3
import time
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="CRM Lite — Global Search Microservice",
    description="High-performance read-only federated search service for Leads and Customers.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "backend" / "crm_lite.db"

class LeadResult(BaseModel):
    id: int
    name: str
    company_name: Optional[str] = None
    phone: str
    email: Optional[str] = None
    status: str
    expected_value: float

class CustomerResult(BaseModel):
    id: int
    name: str
    company_name: Optional[str] = None
    phone: str
    email: Optional[str] = None
    converted_at: Optional[str] = None

class SearchResponse(BaseModel):
    query: str
    total_matches: int
    leads: List[LeadResult]
    customers: List[CustomerResult]
    latency_ms: float

def get_db_connection():
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail="Database file not found. Ensure Django migrations have been run.")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "crm-lite-fastapi-search"}

@app.get("/search/", response_model=SearchResponse)
def global_search(q: str = Query(..., min_length=2, description="Search keyword for name, company, phone, or email")):
    start_time = time.time()
    conn = get_db_connection()
    cursor = conn.cursor()

    param = f"%{q.strip()}%"

    # 1. Search Leads
    cursor.execute("""
        SELECT id, name, company_name, phone, email, status, expected_value
        FROM leads_lead
        WHERE name LIKE ? OR company_name LIKE ? OR phone LIKE ? OR email LIKE ?
        LIMIT 25
    """, (param, param, param, param))
    lead_rows = cursor.fetchall()
    leads = [
        LeadResult(
            id=row["id"],
            name=row["name"],
            company_name=row["company_name"],
            phone=row["phone"],
            email=row["email"],
            status=row["status"],
            expected_value=float(row["expected_value"] or 0),
        )
        for row in lead_rows
    ]

    # 2. Search Customers
    cursor.execute("""
        SELECT id, name, company_name, phone, email, converted_at
        FROM customers_customer
        WHERE name LIKE ? OR company_name LIKE ? OR phone LIKE ? OR email LIKE ?
        LIMIT 25
    """, (param, param, param, param))
    customer_rows = cursor.fetchall()
    customers = [
        CustomerResult(
            id=row["id"],
            name=row["name"],
            company_name=row["company_name"],
            phone=row["phone"],
            email=row["email"],
            converted_at=row["converted_at"],
        )
        for row in customer_rows
    ]

    conn.close()
    latency = round((time.time() - start_time) * 1000, 2)

    return SearchResponse(
        query=q,
        total_matches=len(leads) + len(customers),
        leads=leads,
        customers=customers,
        latency_ms=latency,
    )
