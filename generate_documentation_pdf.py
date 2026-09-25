import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
    HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

# ----------------------------------------------------------------------
# Numbered Canvas for Running Headers and Footers
# ----------------------------------------------------------------------
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages):
        # Suppress header & footer on cover page (page 1)
        if self._pageNumber == 1:
            return

        self.saveState()

        # Running Header
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#0F172A"))
        self.drawString(54, 11 * 72 - 36, "CRM LITE")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(108, 11 * 72 - 36, "|   Technical Architecture & System Documentation")
        self.drawRightString(8.5 * 72 - 54, 11 * 72 - 36, "v1.0.0 — Production Specification")

        # Top divider line
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.75)
        self.line(54, 11 * 72 - 42, 8.5 * 72 - 54, 11 * 72 - 42)

        # Bottom divider line
        self.line(54, 46, 8.5 * 72 - 54, 46)

        # Running Footer
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(54, 32, "Confidential — Customer Follow-Up & Lead Management Platform")
        page_str = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(8.5 * 72 - 54, 32, page_str)

        self.restoreState()


def create_documentation_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()

    # Custom Color Palette
    PRIMARY = colors.HexColor("#0F172A")       # Slate 900
    BRAND = colors.HexColor("#0D9488")         # Teal 600
    ACCENT_GREEN = colors.HexColor("#059669")  # Emerald 600
    ACCENT_BLUE = colors.HexColor("#0284C7")   # Sky 600
    TEXT_DARK = colors.HexColor("#1E293B")     # Slate 800
    TEXT_MUTED = colors.HexColor("#64748B")    # Slate 500
    BG_LIGHT = colors.HexColor("#F8FAFC")      # Slate 50
    BORDER_COLOR = colors.HexColor("#E2E8F0")  # Slate 200

    # Typography Styles
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=30,
        leading=36,
        textColor=PRIMARY,
        alignment=0,
        spaceAfter=8,
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=15,
        leading=20,
        textColor=BRAND,
        alignment=0,
        spaceAfter=14,
    )

    desc_style = ParagraphStyle(
        'CoverDesc',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=16,
        textColor=TEXT_MUTED,
        spaceAfter=24,
    )

    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=PRIMARY,
        spaceBefore=16,
        spaceAfter=10,
        keepWithNext=True,
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=BRAND,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True,
    )

    h3_style = ParagraphStyle(
        'SectionH3',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=PRIMARY,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True,
    )

    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14.5,
        textColor=TEXT_DARK,
        spaceAfter=8,
    )

    bullet_style = ParagraphStyle(
        'DocBullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13.5,
        textColor=TEXT_DARK,
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=4,
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=13,
        textColor=TEXT_DARK,
    )

    code_style = ParagraphStyle(
        'CodeSnippet',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=11.5,
        textColor=colors.HexColor("#0F172A"),
    )

    th_style = ParagraphStyle(
        'TableHead',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
    )

    tb_style = ParagraphStyle(
        'TableBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=TEXT_DARK,
    )

    tb_bold = ParagraphStyle(
        'TableBodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=TEXT_DARK,
    )

    story = []
    PAGE_WIDTH = 504  # 8.5 * 72 - 108

    # ==================================================================
    # COVER PAGE
    # ==================================================================
    story.append(Spacer(1, 20))

    # Top Brand Ribbon
    brand_table = Table(
        [[
            Paragraph("<b>ENTERPRISE SYSTEM SPECIFICATION</b>", ParagraphStyle('Ribbon', fontName='Helvetica-Bold', fontSize=9, textColor=BRAND)),
            Paragraph("<b>STATUS: PRODUCTION-GRADE</b>", ParagraphStyle('RibbonR', fontName='Helvetica-Bold', fontSize=9, textColor=ACCENT_GREEN, alignment=2))
        ]],
        colWidths=[252, 252]
    )
    brand_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(brand_table)
    story.append(Spacer(1, 10))

    story.append(HRFlowable(width="100%", thickness=2, color=BRAND, spaceBefore=0, spaceAfter=20))

    story.append(Paragraph("CRM Lite Platform", title_style))
    story.append(Paragraph("Customer Follow-Up & Sales Lead Management System", subtitle_style))
    story.append(Paragraph(
        "A full-stack, enterprise-grade CRM engineered for modern sales pipelines, featuring real-time "
        "Kanban progression, atomic transaction customer conversion, automated follow-up scheduling, "
        "comprehensive chronological audit timelines, and live KPI intelligence dashboards.",
        desc_style
    ))

    # Key Metadata Box
    meta_data = [
        [
            Paragraph("<b>Document Ref:</b>", tb_bold), Paragraph("CRMLITE-TECH-SPEC-2026", tb_style),
            Paragraph("<b>Architecture:</b>", tb_bold), Paragraph("Decoupled SPA / REST API", tb_style)
        ],
        [
            Paragraph("<b>Backend Engine:</b>", tb_bold), Paragraph("Python 3.14 / Django 6.1 / DRF 3.18", tb_style),
            Paragraph("<b>Database:</b>", tb_bold), Paragraph("PostgreSQL (Prod) / SQLite (Dev)", tb_style)
        ],
        [
            Paragraph("<b>Frontend Stack:</b>", tb_bold), Paragraph("React 19 / Vite 8.3 / React Router v7", tb_style),
            Paragraph("<b>Authentication:</b>", tb_bold), Paragraph("JWT (Access & Refresh Rotation)", tb_style)
        ],
        [
            Paragraph("<b>Design System:</b>", tb_bold), Paragraph("Vanilla CSS Glassmorphism + Dual Themes", tb_style),
            Paragraph("<b>API Docs:</b>", tb_bold), Paragraph("OpenAPI 3.0 (drf-spectacular / Swagger)", tb_style)
        ],
        [
            Paragraph("<b>Release Date:</b>", tb_bold), Paragraph("September 2026", tb_style),
            Paragraph("<b>Author:</b>", tb_bold), Paragraph("Engineering & Solutions Architecture Team", tb_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[100, 152, 100, 152])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 24))

    # Default Demo Credentials Callout on Cover
    cred_heading = ParagraphStyle('CredHead', fontName='Helvetica-Bold', fontSize=10, textColor=PRIMARY, spaceAfter=6)
    cred_data = [
        [
            Paragraph("<b>Role</b>", th_style),
            Paragraph("<b>Default Email / Username</b>", th_style),
            Paragraph("<b>Default Password</b>", th_style),
            Paragraph("<b>Scope & Core Capabilities</b>", th_style)
        ],
        [
            Paragraph("<b>Admin / Mentor</b>", tb_bold),
            Paragraph("<code>admin@crmlite.com</code>", code_style),
            Paragraph("<code>Admin@123</code>", code_style),
            Paragraph("Full control, team management, lead deletion, global reporting", tb_style)
        ],
        [
            Paragraph("<b>Sales Manager</b>", tb_bold),
            Paragraph("<code>manager@crmlite.com</code>", code_style),
            Paragraph("<code>Manager@123</code>", code_style),
            Paragraph("Team lead visibility, rep assignment, customer conversion, CSV reports", tb_style)
        ],
        [
            Paragraph("<b>Sales Executive (Alex)</b>", tb_bold),
            Paragraph("<code>alex@crmlite.com</code>", code_style),
            Paragraph("<code>Alex@123</code>", code_style),
            Paragraph("Assigned lead pipeline, follow-up scheduling, notes logging", tb_style)
        ],
        [
            Paragraph("<b>Sales Executive (Sarah)</b>", tb_bold),
            Paragraph("<code>sarah@crmlite.com</code>", code_style),
            Paragraph("<code>Sarah@123</code>", code_style),
            Paragraph("Assigned lead pipeline, follow-up scheduling, notes logging", tb_style)
        ]
    ]
    cred_table = Table(cred_data, colWidths=[95, 125, 84, 200])
    cred_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(Paragraph("<b>Pre-Configured Development & Evaluation Accounts</b>", cred_heading))
    story.append(cred_table)

    story.append(PageBreak())

    # ==================================================================
    # TABLE OF CONTENTS
    # ==================================================================
    story.append(Paragraph("Table of Contents", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=4, spaceAfter=14))

    toc_items = [
        ("1. Executive Summary & System Overview", "Purpose, key pillars, operational goals, target users"),
        ("2. High-Level System Architecture", "Decoupled SPA, reverse proxy, REST backend, databases"),
        ("3. Role-Based Access Control (RBAC) & Security", "3-tier permission matrix, JWT lifecycle, security guardrails"),
        ("4. Relational Database Schema & Data Models", "Entity specifications, relationships, constraints, indexes"),
        ("5. REST API Reference & Endpoints", "Auth, Leads, Pipeline, Follow-ups, Customers, Reports"),
        ("6. Frontend Architecture & Design System", "React 19 structure, state context, theme engine, components"),
        ("7. Core Business Logic & Data Validation Rules", "Atomic conversion, deduplication, past-date prevention"),
        ("8. Testing Strategy & Quality Assurance", "Automated backend test suite, coverage, bundle validation"),
        ("9. Production Deployment & DevOps", "PostgreSQL, Gunicorn, Nginx, environment variables, SSL"),
        ("10. Troubleshooting & Support Reference", "Common failure modes, resolutions, logs, seeding")
    ]

    toc_data = []
    for num_title, desc in toc_items:
        toc_data.append([
            Paragraph(f"<b>{num_title}</b>", tb_bold),
            Paragraph(desc, tb_style)
        ])
    toc_table = Table(toc_data, colWidths=[204, 300])
    toc_table.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(toc_table)
    story.append(Spacer(1, 16))

    # ==================================================================
    # SECTION 1: EXECUTIVE SUMMARY
    # ==================================================================
    story.append(Paragraph("1. Executive Summary & System Overview", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=10))

    story.append(Paragraph(
        "<b>CRM Lite</b> is a specialized, production-ready Customer Relationship Management application designed "
        "to streamline the sales pipeline from initial lead generation through customer conversion and post-sale retention. "
        "Traditional enterprise CRMs often suffer from bloated user interfaces, excessive configuration overhead, and poor "
        "performance. CRM Lite addresses these challenges by delivering an agile, high-performance platform centered on five core operational pillars:",
        body_style
    ))

    pillars = [
        ("Visual Kanban Pipeline:", "Real-time deal progression through distinct pipeline stages (New, Contacted, Demo Scheduled, Negotiation, Qualified, Won, Lost) with immediate status transitions."),
        ("Atomic Customer Conversion:", "Safe, transaction-wrapped conversion of qualified leads into permanent Customer accounts, preventing partial or duplicate records and preserving complete historical audit notes."),
        ("Proactive Follow-up Engine:", "Smart scheduling of future interactions with automated overdue detection, today's schedule alerts, and mandatory outcome logging upon completion."),
        ("Chronological Communication Audit Trail:", "Detailed logging of calls, WhatsApp messages, emails, demos, and objection notes linked to both reps and leads for full team transparency."),
        ("Live Real-Time KPI Analytics:", "Direct database aggregation of win rates, pipeline value, monthly trends, and sales rep performance without hardcoded metrics or stale caches.")
    ]
    for p_title, p_desc in pillars:
        story.append(Paragraph(f"• <b>{p_title}</b> {p_desc}", bullet_style))

    story.append(Spacer(1, 10))

    # ==================================================================
    # SECTION 2: SYSTEM ARCHITECTURE
    # ==================================================================
    story.append(Paragraph("2. High-Level System Architecture", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=10))

    story.append(Paragraph(
        "CRM Lite uses a decoupled, three-tier architecture separating the client single-page application (SPA), "
        "stateless RESTful backend services, and relational persistence storage. This separation ensures horizontal scalability, "
        "independent frontend and backend deployments, and security enforcement at the API gateway layer.",
        body_style
    ))

    arch_layers = [
        [Paragraph("<b>Layer</b>", th_style), Paragraph("<b>Technology</b>", th_style), Paragraph("<b>Responsibilities & Functional Scope</b>", th_style)],
        [
            Paragraph("<b>Client Presentation</b>", tb_bold),
            Paragraph("React 19, Vite 8.3,<br/>React Router v7", tb_style),
            Paragraph("Single Page Application (SPA), role-based view routing, glassmorphism UI, theme state context, Axios interceptor for JWT auto-refresh.", tb_style)
        ],
        [
            Paragraph("<b>API Gateway / Proxy</b>", tb_bold),
            Paragraph("Nginx / Caddy<br/>(Reverse Proxy)", tb_style),
            Paragraph("SSL/TLS termination, static asset caching, request routing, rate limiting, and CORS header management.", tb_style)
        ],
        [
            Paragraph("<b>Backend REST Core</b>", tb_bold),
            Paragraph("Django 6.1,<br/>DRF 3.18", tb_style),
            Paragraph("Stateless REST API, JWT authentication, RBAC permission enforcement, business validation rules, atomic database transactions, OpenAPI documentation.", tb_style)
        ],
        [
            Paragraph("<b>Persistence Store</b>", tb_bold),
            Paragraph("PostgreSQL 16+<br/>(SQLite dev fallback)", tb_style),
            Paragraph("ACID transactional relational data, foreign key integrity constraints (PROTECT/CASCADE), composite B-tree indexes on lookup columns.", tb_style)
        ],
        [
            Paragraph("<b>Search Microservice</b>", tb_bold),
            Paragraph("FastAPI,<br/>Uvicorn", tb_style),
            Paragraph("Optional sub-10ms federated prospect search across leads and customers with in-memory caching.", tb_style)
        ]
    ]
    arch_table = Table(arch_layers, colWidths=[100, 110, 294])
    arch_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(arch_table)
    story.append(Spacer(1, 14))

    # Lifecycle Diagram Box
    story.append(Paragraph("<b>End-to-End Sales Lead Lifecycle:</b>", h3_style))
    story.append(Paragraph(
        "<b>1. Ingestion:</b> Lead created via web form, LinkedIn, or referral → Assigned status <code>NEW</code>.<br/>"
        "<b>2. Assignment:</b> Sales Manager reviews lead profile and assigns to an available Sales Executive.<br/>"
        "<b>3. Outreach & Follow-up:</b> Rep logs calls, demos, or emails; schedules next follow-up date and time.<br/>"
        "<b>4. Pipeline Stages:</b> Deal moves through <code>CONTACTED</code> → <code>DEMO_SCHEDULED</code> → <code>NEGOTIATION</code> → <code>QUALIFIED</code>.<br/>"
        "<b>5. Conversion or Loss:</b> If qualified, Sales Manager triggers <code>/convert/</code> inside an atomic transaction, generating a <code>Customer</code> profile and marking the lead <code>WON</code>. If lost, a mandatory reason is recorded.",
        callout_style
    ))
    story.append(Spacer(1, 10))

    story.append(PageBreak())

    # ==================================================================
    # SECTION 3: ROLE-BASED ACCESS CONTROL (RBAC) & SECURITY
    # ==================================================================
    story.append(Paragraph("3. Role-Based Access Control (RBAC) & Security", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=10))

    story.append(Paragraph(
        "Security in CRM Lite is enforced at the server level on every incoming HTTP request. Client-side route guards "
        "and conditional button rendering serve strictly as user experience enhancements; all permissions are verified "
        "inside Django REST Framework permission classes and model querysets.",
        body_style
    ))

    rbac_data = [
        [
            Paragraph("<b>Operation / Capability</b>", th_style),
            Paragraph("<b>Admin / Mentor</b>", th_style),
            Paragraph("<b>Sales Manager</b>", th_style),
            Paragraph("<b>Sales Executive</b>", th_style)
        ],
        [
            Paragraph("<b>User Management (Create/Delete)</b>", tb_bold),
            Paragraph("Full Control", tb_style),
            Paragraph("View Only", tb_style),
            Paragraph("No Access (403)", tb_style)
        ],
        [
            Paragraph("<b>Lead Listing & Visibility</b>", tb_bold),
            Paragraph("All Leads Org-Wide", tb_style),
            Paragraph("All Team Leads", tb_style),
            Paragraph("Assigned / Created Only", tb_style)
        ],
        [
            Paragraph("<b>Create & Edit Leads</b>", tb_bold),
            Paragraph("Yes (Global)", tb_style),
            Paragraph("Yes (Team)", tb_style),
            Paragraph("Yes (Own Leads)", tb_style)
        ],
        [
            Paragraph("<b>Delete Lead Records</b>", tb_bold),
            Paragraph("Yes (Permitted)", tb_style),
            Paragraph("Forbidden (403)", tb_style),
            Paragraph("Forbidden (403)", tb_style)
        ],
        [
            Paragraph("<b>Assign / Reassign Leads</b>", tb_bold),
            Paragraph("Yes (Any User)", tb_style),
            Paragraph("Yes (Team Members)", tb_style),
            Paragraph("Forbidden (403)", tb_style)
        ],
        [
            Paragraph("<b>Convert Lead to Customer</b>", tb_bold),
            Paragraph("Yes (Qualified Leads)", tb_style),
            Paragraph("Yes (Qualified Leads)", tb_style),
            Paragraph("Forbidden (403)", tb_style)
        ],
        [
            Paragraph("<b>Communication Notes & Follow-ups</b>", tb_bold),
            Paragraph("Yes (Global)", tb_style),
            Paragraph("Yes (Team)", tb_style),
            Paragraph("Yes (Own Leads Only)", tb_style)
        ],
        [
            Paragraph("<b>Performance Reports</b>", tb_bold),
            Paragraph("Full Organization", tb_style),
            Paragraph("Full Team Summary", tb_style),
            Paragraph("Own Metrics Scope", tb_style)
        ],
        [
            Paragraph("<b>Export Reports to CSV</b>", tb_bold),
            Paragraph("Yes (Unlimited)", tb_style),
            Paragraph("Yes (Team Data)", tb_style),
            Paragraph("Forbidden (403)", tb_style)
        ]
    ]
    rbac_table = Table(rbac_data, colWidths=[164, 110, 110, 120])
    rbac_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 4.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(rbac_table)
    story.append(Spacer(1, 12))

    story.append(Paragraph("<b>Authentication & Token Lifecycle Architecture:</b>", h2_style))
    story.append(Paragraph(
        "• <b>JWT Token Pair:</b> On successful authentication (<code>POST /api/auth/login/</code>), the server returns a short-lived Access Token (60 min expiration) and a long-lived Refresh Token (7 days).<br/>"
        "• <b>Silent Interceptor Refresh:</b> The frontend Axios client automatically intercepts <code>401 Unauthorized</code> responses, queues concurrent requests, fetches a fresh access token from <code>/api/auth/refresh/</code>, and replays failed calls seamlessly.<br/>"
        "• <b>Payload Claims:</b> User ID, email, role, and full name are embedded directly in the JWT payload for zero-roundtrip client permission checks.<br/>"
        "• <b>Secure Password Hashing:</b> Passwords are protected using Django's PBKDF2 with SHA-256 algorithm (390,000 iterations by default).",
        body_style
    ))
    story.append(Spacer(1, 10))

    # ==================================================================
    # SECTION 4: DATABASE SCHEMA & DATA MODELS
    # ==================================================================
    story.append(Paragraph("4. Relational Database Schema & Data Models", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=10))

    story.append(Paragraph(
        "The relational database schema is normalized to 3NF, utilizing strict foreign key constraints, "
        "one-to-one conversion mapping, and targeted indexes to guarantee sub-millisecond query performance.",
        body_style
    ))

    schema_data = [
        [Paragraph("<b>Entity / Table</b>", th_style), Paragraph("<b>Key Columns & Types</b>", th_style), Paragraph("<b>Relationships & Constraints</b>", th_style)],
        [
            Paragraph("<b>User</b><br/>(<code>accounts_user</code>)", tb_bold),
            Paragraph("<code>id (PK)</code>, <code>email (UK)</code>, <code>password</code>, <code>first_name</code>, <code>last_name</code>, <code>phone</code>, <code>role (Enum)</code>, <code>is_active</code>", tb_style),
            Paragraph("Custom User model where <code>email</code> is the unique authentication field. Roles: <code>ADMIN</code>, <code>MANAGER</code>, <code>EXECUTIVE</code>.", tb_style)
        ],
        [
            Paragraph("<b>LeadSource</b><br/>(<code>leads_leadsource</code>)", tb_bold),
            Paragraph("<code>id (PK)</code>, <code>name (UK)</code>, <code>description</code>, <code>is_active</code>, <code>created_at</code>", tb_style),
            Paragraph("Tracks acquisition channels (Website, LinkedIn, Referral). Linked to leads via <code>on_delete=models.SET_NULL</code>.", tb_style)
        ],
        [
            Paragraph("<b>Lead</b><br/>(<code>leads_lead</code>)", tb_bold),
            Paragraph("<code>id (PK)</code>, <code>name</code>, <code>phone (Index)</code>, <code>email (Index)</code>, <code>company_name</code>, <code>status (Index)</code>, <code>priority</code>, <code>expected_value</code>, <code>lost_reason</code>", tb_style),
            Paragraph("Core prospect record. <code>assigned_to</code> FK to User. Active status prevents duplicate phone entries. Status: <code>NEW</code>, <code>CONTACTED</code>, <code>DEMO</code>, <code>NEGOTIATION</code>, <code>QUALIFIED</code>, <code>WON</code>, <code>LOST</code>.", tb_style)
        ],
        [
            Paragraph("<b>Customer</b><br/>(<code>customers_customer</code>)", tb_bold),
            Paragraph("<code>id (PK)</code>, <code>lead_id (FK_UK)</code>, <code>name</code>, <code>phone</code>, <code>email</code>, <code>company_name</code>, <code>address</code>, <code>converted_at</code>", tb_style),
            Paragraph("OneToOne relationship to Lead with <code>on_delete=models.PROTECT</code> to guarantee financial audit history cannot be deleted.", tb_style)
        ],
        [
            Paragraph("<b>FollowUp</b><br/>(<code>followups_followup</code>)", tb_bold),
            Paragraph("<code>id (PK)</code>, <code>lead_id (FK)</code>, <code>assigned_to_id (FK)</code>, <code>follow_up_at (Index)</code>, <code>purpose</code>, <code>status (Index)</code>, <code>outcome</code>", tb_style),
            Paragraph("Follow-up tasks. Status: <code>PENDING</code>, <code>COMPLETED</code>, <code>CANCELLED</code>, <code>OVERDUE</code>. Past-date scheduling rejected by validator.", tb_style)
        ],
        [
            Paragraph("<b>LeadNote</b><br/>(<code>leads_leadnote</code>)", tb_bold),
            Paragraph("<code>id (PK)</code>, <code>lead_id (FK)</code>, <code>user_id (FK)</code>, <code>note_type</code>, <code>note_text</code>, <code>created_at</code>", tb_style),
            Paragraph("Timeline communication entries. Types: <code>CALL</code>, <code>WHATSAPP</code>, <code>EMAIL</code>, <code>MEETING</code>, <code>DEMO</code>, <code>OBJECTION</code>, <code>GENERAL</code>.", tb_style)
        ],
        [
            Paragraph("<b>ActivityLog</b><br/>(<code>activity_activitylog</code>)", tb_bold),
            Paragraph("<code>id (PK)</code>, <code>entity_type</code>, <code>entity_id</code>, <code>action</code>, <code>old_value (JSON)</code>, <code>new_value (JSON)</code>, <code>performed_by_id (FK)</code>", tb_style),
            Paragraph("Immutable audit trail logging state changes (stage transitions, assignments, customer conversions).", tb_style)
        ]
    ]
    schema_table = Table(schema_data, colWidths=[100, 194, 210])
    schema_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 4.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(schema_table)

    story.append(PageBreak())

    # ==================================================================
    # SECTION 5: REST API REFERENCE
    # ==================================================================
    story.append(Paragraph("5. REST API Reference & Endpoints", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=10))

    story.append(Paragraph(
        "All authenticated endpoints expect standard Bearer tokens: <code>Authorization: Bearer &lt;access_token&gt;</code>. "
        "The complete interactive Swagger UI is available at <code>/api/docs/</code> and the OpenAPI schema is accessible at <code>/api/schema/</code>.",
        body_style
    ))

    api_endpoints = [
        [Paragraph("<b>HTTP Method</b>", th_style), Paragraph("<b>Endpoint Path</b>", th_style), Paragraph("<b>Functionality & Query Parameters</b>", th_style), Paragraph("<b>Roles Permitted</b>", th_style)],
        [
            Paragraph("<code>POST</code>", tb_bold),
            Paragraph("<code>/api/auth/login/</code>", code_style),
            Paragraph("Accepts <code>email</code> and <code>password</code>; returns JWT access/refresh pair and user object.", tb_style),
            Paragraph("Public", tb_style)
        ],
        [
            Paragraph("<code>POST</code>", tb_bold),
            Paragraph("<code>/api/auth/refresh/</code>", code_style),
            Paragraph("Accepts <code>refresh</code> token; generates fresh access token.", tb_style),
            Paragraph("Public", tb_style)
        ],
        [
            Paragraph("<code>GET, PATCH</code>", tb_bold),
            Paragraph("<code>/api/auth/me/</code>", code_style),
            Paragraph("Retrieves or updates authenticated user profile and contact details.", tb_style),
            Paragraph("Authenticated", tb_style)
        ],
        [
            Paragraph("<code>GET, POST</code>", tb_bold),
            Paragraph("<code>/api/leads/</code>", code_style),
            Paragraph("List and create leads. Filter by <code>status</code>, <code>priority</code>, <code>source</code>, <code>keyword</code>.", tb_style),
            Paragraph("All (Scoped)", tb_style)
        ],
        [
            Paragraph("<code>GET, PATCH</code>", tb_bold),
            Paragraph("<code>/api/leads/{id}/</code>", code_style),
            Paragraph("Retrieve and update single lead contact, status, or details.", tb_style),
            Paragraph("Admin, Manager, Rep", tb_style)
        ],
        [
            Paragraph("<code>DELETE</code>", tb_bold),
            Paragraph("<code>/api/leads/{id}/</code>", code_style),
            Paragraph("Permanently remove lead record. Non-admins receive 403 Forbidden.", tb_style),
            Paragraph("Admin Only", tb_style)
        ],
        [
            Paragraph("<code>POST</code>", tb_bold),
            Paragraph("<code>/api/leads/{id}/convert/</code>", code_style),
            Paragraph("Atomically convert QUALIFIED lead to Customer record and mark WON.", tb_style),
            Paragraph("Admin, Manager", tb_style)
        ],
        [
            Paragraph("<code>POST</code>", tb_bold),
            Paragraph("<code>/api/leads/{id}/assign/</code>", code_style),
            Paragraph("Reassign lead to designated executive user ID.", tb_style),
            Paragraph("Admin, Manager", tb_style)
        ],
        [
            Paragraph("<code>GET, POST</code>", tb_bold),
            Paragraph("<code>/api/leads/{id}/notes/</code>", code_style),
            Paragraph("List or record communication notes (Call, WhatsApp, Demo, etc.).", tb_style),
            Paragraph("Admin, Manager, Rep", tb_style)
        ],
        [
            Paragraph("<code>GET</code>", tb_bold),
            Paragraph("<code>/api/leads/{id}/timeline/</code>", code_style),
            Paragraph("Chronological audit history of notes and system actions.", tb_style),
            Paragraph("Admin, Manager, Rep", tb_style)
        ],
        [
            Paragraph("<code>GET</code>", tb_bold),
            Paragraph("<code>/api/leads/pipeline/</code>", code_style),
            Paragraph("Leads grouped into columns by pipeline stage for Kanban visualization.", tb_style),
            Paragraph("All (Scoped)", tb_style)
        ],
        [
            Paragraph("<code>GET, POST</code>", tb_bold),
            Paragraph("<code>/api/follow-ups/</code>", code_style),
            Paragraph("List and schedule follow-ups. Reject past scheduling timestamps.", tb_style),
            Paragraph("All (Scoped)", tb_style)
        ],
        [
            Paragraph("<code>POST</code>", tb_bold),
            Paragraph("<code>/api/follow-ups/{id}/complete/</code>", code_style),
            Paragraph("Mark task completed and persist required outcome details.", tb_style),
            Paragraph("Assigned Rep, Mgr, Admin", tb_style)
        ],
        [
            Paragraph("<code>GET</code>", tb_bold),
            Paragraph("<code>/api/follow-ups/overdue/</code>", code_style),
            Paragraph("Retrieves all pending follow-ups where scheduled date < now.", tb_style),
            Paragraph("All (Scoped)", tb_style)
        ],
        [
            Paragraph("<code>GET</code>", tb_bold),
            Paragraph("<code>/api/customers/</code>", code_style),
            Paragraph("List converted client accounts and conversion timestamps.", tb_style),
            Paragraph("All (Read-Only)", tb_style)
        ],
        [
            Paragraph("<code>GET</code>", tb_bold),
            Paragraph("<code>/api/reports/summary/</code>", code_style),
            Paragraph("Real-time aggregated KPIs: conversion %, pipeline value, rep metrics.", tb_style),
            Paragraph("All (Scoped)", tb_style)
        ],
        [
            Paragraph("<code>GET</code>", tb_bold),
            Paragraph("<code>/api/reports/export/?format=csv</code>", code_style),
            Paragraph("Streaming downloadable CSV export of filtered pipeline data.", tb_style),
            Paragraph("Admin, Manager", tb_style)
        ],
        [
            Paragraph("<code>GET, POST, PATCH</code>", tb_bold),
            Paragraph("<code>/api/users/</code>", code_style),
            Paragraph("List, create, update, or deactivate team member accounts.", tb_style),
            Paragraph("Admin, Manager (View)", tb_style)
        ]
    ]
    api_table = Table(api_endpoints, colWidths=[65, 140, 209, 90])
    api_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(api_table)

    story.append(PageBreak())

    # ==================================================================
    # SECTION 6: FRONTEND ARCHITECTURE & DESIGN SYSTEM
    # ==================================================================
    story.append(Paragraph("6. Frontend Architecture & Design System", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=10))

    story.append(Paragraph(
        "The user interface is engineered with React 19 and Vite 8.3 without heavy external CSS frameworks (such as Tailwind). "
        "Instead, it implements a bespoke Vanilla CSS design system utilizing CSS Custom Properties (CSS variables) "
        "and modern dark glassmorphism techniques with a native dual-theme engine (White & Emerald Green light mode, Deep Slate dark mode).",
        body_style
    ))

    story.append(Paragraph("<b>State Management & Context Layering:</b>", h2_style))
    story.append(Paragraph(
        "The React application maintains clean, isolated concern boundaries through three top-level Context providers:<br/>"
        "• <b>ThemeProvider (<code>ThemeContext.jsx</code>):</b> Governs dark/light state, sets the <code>data-theme</code> root attribute on the DOM, and synchronizes preference to <code>localStorage</code>.<br/>"
        "• <b>AuthProvider (<code>AuthContext.jsx</code>):</b> Stores the active user profile, provides <code>login()</code> and <code>logout()</code> methods, and initializes user state from persisted local tokens.<br/>"
        "• <b>ToastProvider (<code>ToastContext.jsx</code>):</b> Renders non-intrusive floating feedback notifications across all pages with automated timeout dismissals.",
        body_style
    ))

    story.append(Paragraph("<b>Key User Interface Views:</b>", h2_style))
    ui_views = [
        ("Dashboard (<code>/dashboard</code>):", "Real-time KPI metric cards (Total Leads, Conversion Rate %, Pipeline Value, Overdue Tasks), monthly acquisition trend charts, and urgent follow-up tables."),
        ("Kanban Pipeline Board (<code>/pipeline</code>):", "Interactive drag-and-drop board with edge auto-scrolling and cross-page funnel flipping. Dragging cards near the screen edge or hovering over stage tabs automatically navigates between stage groups (Active Funnel ↔ Closing & Won), while smooth horizontal auto-scrolling enables seamless card repositioning in All-Stages view."),
        ("Lead Management (<code>/leads</code>):", "Data table with multi-parameter search, server pagination, priority badges, source chips, and quick action conversion modals."),
        ("Lead Detail & Audit Trail (<code>/leads/:id</code>):", "Comprehensive 360-degree prospect dossier containing contact info, scheduled interactions, and a chronological communication audit timeline."),
        ("Follow-up Scheduler (<code>/follow-ups</code>):", "Overdue alerts, today's schedule calendar, and quick-action completion drawers requiring logged interaction outcomes."),
        ("Customer Portfolio (<code>/customers</code>):", "Permanent customer account directory with conversion timestamps and associated converted lead references.")
    ]
    for v_title, v_desc in ui_views:
        story.append(Paragraph(f"• <b>{v_title}</b> {v_desc}", bullet_style))

    story.append(Spacer(1, 10))

    # ==================================================================
    # SECTION 7: CORE BUSINESS LOGIC & DATA VALIDATION RULES
    # ==================================================================
    story.append(Paragraph("7. Core Business Logic & Data Validation Rules", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=10))

    biz_rules = [
        ("Atomic Customer Conversion", "Conversion is wrapped inside <code>django.db.transaction.atomic()</code>. The lead status MUST be <code>QUALIFIED</code>. On conversion, a new <code>Customer</code> row is created, the lead status changes to <code>WON</code>, the <code>converted_at</code> timestamp is frozen, and an immutable <code>ActivityLog</code> is persisted. If any step fails, the entire transaction rolls back to prevent orphan records."),
        ("Phone Number Deduplication", "Creating a lead with a phone number that already exists on an active prospect (status not in <code>['WON', 'LOST']</code>) returns <code>HTTP 400 Bad Request</code>. This prevents multiple reps from unknowingly colliding on the same account."),
        ("Past-Date Follow-up Prevention", "The <code>FollowUpSerializer</code> strictly validates that scheduled times cannot be in the past (<code>follow_up_at >= timezone.now() - timedelta(minutes=5)</code>). Any past timestamp is rejected with validation errors."),
        ("Mandatory Lost Reason", "A lead cannot transition to <code>status = 'LOST'</code> with an empty <code>lost_reason</code> string. This guarantees that sales analytics can accurately aggregate win/loss root causes."),
        ("Negative Value Prevention", "Expected deal revenue cannot be negative (<code>expected_value >= 0</code>). Enforced via model validator constraints.")
    ]
    for b_title, b_desc in biz_rules:
        story.append(Paragraph(f"<b>{b_title}:</b> {b_desc}", body_style))

    story.append(PageBreak())

    # ==================================================================
    # SECTION 8: TESTING STRATEGY & QUALITY ASSURANCE
    # ==================================================================
    story.append(Paragraph("8. Testing Strategy & Quality Assurance", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=10))

    story.append(Paragraph(
        "CRM Lite includes automated test suites covering authentication, role isolation, lead CRUD, past follow-up rejection, "
        "and atomic customer conversion running on Django's test runner in isolated in-memory test databases.",
        body_style
    ))

    story.append(Paragraph("<b>Executing Backend Automated Tests:</b>", h2_style))
    test_cmd = ParagraphStyle('CmdBox', fontName='Courier-Bold', fontSize=9, textColor=PRIMARY, backColor=BG_LIGHT, borderPadding=6)
    story.append(Paragraph("python backend/manage.py test accounts leads followups", test_cmd))
    story.append(Spacer(1, 10))

    test_cases = [
        [Paragraph("<b>App / Module</b>", th_style), Paragraph("<b>Test Focus Area</b>", th_style), Paragraph("<b>Assertion & Verification Goal</b>", th_style)],
        [
            Paragraph("<b>accounts</b>", tb_bold),
            Paragraph("JWT Auth & Profile", tb_style),
            Paragraph("Verifies 200 on valid credentials; structured 401 on bad password; 401 on missing Authorization header; profile match on <code>/api/auth/me/</code>.", tb_style)
        ],
        [
            Paragraph("<b>leads</b>", tb_bold),
            Paragraph("Role Isolation", tb_style),
            Paragraph("Verifies Sales Executive cannot view other reps' leads in queries; direct GET of other reps' lead returns 403/404; Manager sees full team.", tb_style)
        ],
        [
            Paragraph("<b>leads</b>", tb_bold),
            Paragraph("Lead Assignment", tb_style),
            Paragraph("Verifies Manager can assign reps; Executive assignment returns 403 Forbidden.", tb_style)
        ],
        [
            Paragraph("<b>leads</b>", tb_bold),
            Paragraph("Data Integrity", tb_style),
            Paragraph("Duplicate active phone numbers return 400 Bad Request; negative expected values rejected; missing lost reasons on LOST status return 400.", tb_style)
        ],
        [
            Paragraph("<b>leads</b>", tb_bold),
            Paragraph("Atomic Conversion", tb_style),
            Paragraph("Qualified lead converts cleanly into Customer record; lead status updates to WON; duplicate conversion attempts return 400.", tb_style)
        ],
        [
            Paragraph("<b>followups</b>", tb_bold),
            Paragraph("Date & Outcome", tb_style),
            Paragraph("Past scheduling rejected; future scheduling accepted; completion records outcome string and completed_at timestamp.", tb_style)
        ],
        [
            Paragraph("<b>reports</b>", tb_bold),
            Paragraph("Aggregation & CSV", tb_style),
            Paragraph("Dashboard returns exact counts matching database; CSV export streams valid CSV headers with attachment Content-Disposition.", tb_style)
        ]
    ]
    test_table = Table(test_cases, colWidths=[90, 130, 284])
    test_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(test_table)
    story.append(Spacer(1, 12))

    # ==================================================================
    # SECTION 9: PRODUCTION DEPLOYMENT & DEVOPS
    # ==================================================================
    story.append(Paragraph("9. Production Deployment & DevOps", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=10))

    story.append(Paragraph(
        "<b>1. PostgreSQL Database Configuration:</b> Create a dedicated user and database with full schema privileges:<br/>"
        "<code>CREATE DATABASE crm_lite_db;<br/>"
        "CREATE USER crm_admin WITH PASSWORD 'StrongPassword123';<br/>"
        "GRANT ALL PRIVILEGES ON DATABASE crm_lite_db TO crm_admin;</code><br/><br/>"
        "<b>2. Environment Setup (<code>backend/.env</code>):</b><br/>"
        "Set <code>DEBUG=False</code>, generate a unique <code>SECRET_KEY</code>, configure <code>DB_ENGINE=postgresql</code>, "
        "and restrict <code>ALLOWED_HOSTS</code> and <code>CORS_ALLOWED_ORIGINS</code> to your production domain.<br/><br/>"
        "<b>3. Apply Migrations & Collect Static Files:</b><br/>"
        "<code>python backend/manage.py migrate<br/>"
        "python backend/manage.py collectstatic --noinput</code><br/><br/>"
        "<b>4. WSGI Production Server (Gunicorn):</b><br/>"
        "<code>gunicorn config.wsgi:application --chdir backend --bind 127.0.0.1:8000 --workers 3 --timeout 120</code><br/><br/>"
        "<b>5. Frontend Static Asset Build:</b><br/>"
        "<code>cd frontend &amp;&amp; npm run build</code> (outputs optimized production bundle to <code>dist/</code> for Nginx serving).",
        body_style
    ))
    story.append(Spacer(1, 10))

    # ==================================================================
    # SECTION 10: TROUBLESHOOTING & COMMON RESOLUTIONS
    # ==================================================================
    story.append(Paragraph("10. Troubleshooting & Common Resolutions", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=10))

    troubles = [
        ("Login returning HTTP 400 Bad Request", "Ensure client sends JSON payload with keys <code>email</code> and <code>password</code>. The backend serializer strictly requires <code>email</code> rather than a generic <code>username</code> field."),
        ("White Screen on Navigation (useTheme must be used within a ThemeProvider)", "Ensure <code>App.jsx</code> wraps the component router tree inside <code>&lt;ThemeProvider&gt;</code>. Components like <code>Navbar</code> rely on theme state context."),
        ("CORS Errors in Browser Console", "Verify that the frontend origin (e.g. <code>http://localhost:5173</code>) is listed in <code>CORS_ALLOWED_ORIGINS</code> in <code>backend/.env</code>."),
        ("Database Reset / Fresh Seed Data", "To restore all default evaluation users and pipeline mock records, execute: <code>python backend/manage.py seed_data</code>.")
    ]
    for t_issue, t_fix in troubles:
        story.append(Paragraph(f"• <b>Issue: {t_issue}</b><br/><b>Resolution:</b> {t_fix}", body_style))

    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=1, color=BRAND, spaceBefore=10, spaceAfter=10))
    story.append(Paragraph("<b>End of Technical Specification — CRM Lite Platform</b>", ParagraphStyle('EndDoc', fontName='Helvetica-Bold', fontSize=9, textColor=TEXT_MUTED, alignment=1)))

    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Documentation successfully generated at: {output_path}")


if __name__ == '__main__':
    target = os.path.abspath(os.path.join(os.path.dirname(__file__), "CRM_Lite_Documentation.pdf"))
    create_documentation_pdf(target)
