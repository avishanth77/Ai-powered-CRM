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
        self.setFillColor(colors.HexColor("#0D9488"))
        self.drawString(104, 11 * 72 - 36, "|   Comprehensive Product & Features Specification")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawRightString(8.5 * 72 - 54, 11 * 72 - 36, "v2.2 Production Edition")

        # Top divider line
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.75)
        self.line(54, 11 * 72 - 42, 8.5 * 72 - 54, 11 * 72 - 42)

        # Bottom divider line
        self.line(54, 46, 8.5 * 72 - 54, 46)

        # Running Footer
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(54, 32, "Confidential — AI-Powered Customer Relationship & Pipeline Management System")
        page_str = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(8.5 * 72 - 54, 32, page_str)

        self.restoreState()


def create_callout_box(title, text, callout_type="info", width=504):
    """Generates an elegant styled callout block with color-coded accent"""
    color_map = {
        "info": (colors.HexColor("#0284C7"), colors.HexColor("#F0F9FF"), colors.HexColor("#BAE6FD")),
        "ai": (colors.HexColor("#7C3AED"), colors.HexColor("#FAF5FF"), colors.HexColor("#DDD6FE")),
        "success": (colors.HexColor("#059669"), colors.HexColor("#ECFDF5"), colors.HexColor("#A7F3D0")),
        "warning": (colors.HexColor("#D97706"), colors.HexColor("#FFFBEB"), colors.HexColor("#FDE68A")),
        "security": (colors.HexColor("#E11D48"), colors.HexColor("#FFF1F2"), colors.HexColor("#FECDD3")),
    }
    accent_bar, bg_col, border_col = color_map.get(callout_type, color_map["info"])

    t_style = ParagraphStyle(
        'CalloutH',
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11.5,
        textColor=accent_bar,
        spaceAfter=2,
    )
    b_style = ParagraphStyle(
        'CalloutB',
        fontName='Helvetica',
        fontSize=8,
        leading=11.5,
        textColor=colors.HexColor("#1E293B"),
    )

    content = [
        Paragraph(f"<b>{title}</b>", t_style),
        Paragraph(text, b_style)
    ]

    table = Table([[content]], colWidths=[width])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg_col),
        ('BOX', (0,0), (-1,-1), 0.75, border_col),
        ('LINEBEFORE', (0,0), (0,-1), 3.5, accent_bar),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    return table


def build_crm_features_pdf(output_path):
    PAGE_WIDTH = 504  # 8.5 * 72 - 108

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()

    # Brand Colors
    PRIMARY = colors.HexColor("#0F172A")       # Slate 900
    BRAND = colors.HexColor("#0D9488")         # Teal 600
    BRAND_DARK = colors.HexColor("#115E59")    # Teal 800
    ACCENT_AI = colors.HexColor("#7C3AED")     # Purple 600
    ACCENT_GREEN = colors.HexColor("#059669")  # Emerald 600
    ACCENT_BLUE = colors.HexColor("#0284C7")   # Sky 600
    ACCENT_AMBER = colors.HexColor("#D97706")  # Amber 600
    TEXT_DARK = colors.HexColor("#1E293B")     # Slate 800
    TEXT_MUTED = colors.HexColor("#64748B")    # Slate 500
    BG_LIGHT = colors.HexColor("#F8FAFC")      # Slate 50
    BORDER_COLOR = colors.HexColor("#E2E8F0")  # Slate 200

    # Typography Styles
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=27,
        leading=33,
        textColor=PRIMARY,
        spaceAfter=6,
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13.5,
        leading=18,
        textColor=BRAND,
        spaceAfter=10,
    )

    desc_style = ParagraphStyle(
        'CoverDesc',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=15,
        textColor=TEXT_DARK,
        spaceAfter=18,
    )

    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=PRIMARY,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True,
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11.5,
        leading=15,
        textColor=BRAND_DARK,
        spaceBefore=10,
        spaceAfter=5,
        keepWithNext=True,
    )

    h3_style = ParagraphStyle(
        'SectionH3',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13,
        textColor=PRIMARY,
        spaceBefore=7,
        spaceAfter=3,
        keepWithNext=True,
    )

    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=TEXT_DARK,
        spaceAfter=6,
    )

    bullet_style = ParagraphStyle(
        'DocBullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.2,
        leading=12,
        textColor=TEXT_DARK,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3,
    )

    code_style = ParagraphStyle(
        'CodeSnippet',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7.5,
        leading=10.5,
        textColor=colors.HexColor("#0F172A"),
    )

    th_style = ParagraphStyle(
        'TableHead',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=colors.white,
    )

    tb_style = ParagraphStyle(
        'TableBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10.5,
        textColor=TEXT_DARK,
    )

    tb_bold = ParagraphStyle(
        'TableBodyBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10.5,
        textColor=TEXT_DARK,
    )

    story = []

    # ==================================================================
    # COVER PAGE
    # ==================================================================
    story.append(Spacer(1, 10))

    # Top Brand Ribbon
    brand_table = Table(
        [[
            Paragraph("<b>ENTERPRISE SYSTEM SPECIFICATION</b>", ParagraphStyle('RibbonL', fontName='Helvetica-Bold', fontSize=8.5, textColor=BRAND)),
            Paragraph("<b>STATUS: PRODUCTION v2.2 (AI-ENABLED)</b>", ParagraphStyle('RibbonR', fontName='Helvetica-Bold', fontSize=8.5, textColor=ACCENT_AI, alignment=2))
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
    story.append(Spacer(1, 6))

    story.append(HRFlowable(width="100%", thickness=2.5, color=BRAND, spaceBefore=0, spaceAfter=14))

    story.append(Paragraph("CRM Lite — Enterprise CRM & AI Deal Intelligence", title_style))
    story.append(Paragraph("Complete Product Capabilities, AI Systems & Feature Specification Guide", subtitle_style))
    story.append(Paragraph(
        "A full-stack, enterprise-grade CRM engineered to streamline modern sales pipelines, automate follow-up governance, "
        "execute atomic customer conversions, deliver multimodal AI speech-to-text call analysis, provide a live-grounded "
        "CRM Copilot assistant, and deliver real-time KPI intelligence.",
        desc_style
    ))

    # Key Architecture Metadata Box
    meta_data = [
        [
            Paragraph("<b>Document Ref:</b>", tb_bold), Paragraph("CRMLITE-FEATURE-SPEC-2026", tb_style),
            Paragraph("<b>Release Version:</b>", tb_bold), Paragraph("v2.2.0 Production Release", tb_style)
        ],
        [
            Paragraph("<b>Frontend Framework:</b>", tb_bold), Paragraph("React 19 / Vite 8.3 / React Router v7", tb_style),
            Paragraph("<b>UI Design System:</b>", tb_bold), Paragraph("Vanilla CSS Dark Glassmorphism", tb_style)
        ],
        [
            Paragraph("<b>Backend Engine:</b>", tb_bold), Paragraph("Python 3.14 / Django 6.1 / DRF 3.18", tb_style),
            Paragraph("<b>Database Systems:</b>", tb_bold), Paragraph("PostgreSQL (Production) / SQLite (Dev)", tb_style)
        ],
        [
            Paragraph("<b>AI Infrastructure:</b>", tb_bold), Paragraph("Google GenAI / Gemini 2.5 Flash", tb_style),
            Paragraph("<b>AI Capabilities:</b>", tb_bold), Paragraph("Speech-to-Text, Copilot, Dossiers", tb_style)
        ],
        [
            Paragraph("<b>Microservice:</b>", tb_bold), Paragraph("FastAPI Federated Global Search", tb_style),
            Paragraph("<b>Security / Auth:</b>", tb_bold), Paragraph("JWT Bearer Auth + 3-Tier RBAC", tb_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[95, 157, 95, 157])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 0), (-1, -1), 4.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 14))

    # Pre-Configured Demo Credentials Callout on Cover
    cred_heading = ParagraphStyle('CredHead', fontName='Helvetica-Bold', fontSize=9, textColor=PRIMARY, spaceAfter=4)
    cred_data = [
        [
            Paragraph("<b>Role Persona</b>", th_style),
            Paragraph("<b>Email / Username</b>", th_style),
            Paragraph("<b>Password</b>", th_style),
            Paragraph("<b>Access Tier & System Permissions</b>", th_style)
        ],
        [
            Paragraph("<b>Admin / Mentor</b>", tb_bold),
            Paragraph("<code>admin@crmlite.com</code>", code_style),
            Paragraph("<code>Admin@123</code>", code_style),
            Paragraph("Full root control, user provisioning, lead deletion, global analytics", tb_style)
        ],
        [
            Paragraph("<b>Sales Manager</b>", tb_bold),
            Paragraph("<code>manager@crmlite.com</code>", code_style),
            Paragraph("<code>Manager@123</code>", code_style),
            Paragraph("Team pipeline visibility, lead assignment, customer conversion, CSV reports", tb_style)
        ],
        [
            Paragraph("<b>Sales Executive (Alex)</b>", tb_bold),
            Paragraph("<code>alex@crmlite.com</code>", code_style),
            Paragraph("<code>Alex@123</code>", code_style),
            Paragraph("Assigned leads, follow-up scheduler, call notes, personal metrics", tb_style)
        ],
        [
            Paragraph("<b>Sales Executive (Sarah)</b>", tb_bold),
            Paragraph("<code>sarah@crmlite.com</code>", code_style),
            Paragraph("<code>Sarah@123</code>", code_style),
            Paragraph("Assigned leads, follow-up scheduler, call notes, personal metrics", tb_style)
        ]
    ]
    cred_table = Table(cred_data, colWidths=[95, 125, 84, 200])
    cred_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(Paragraph("<b>Pre-Configured Demo User Credentials (1-Click Login Enabled)</b>", cred_heading))
    story.append(cred_table)
    story.append(Spacer(1, 10))

    story.append(create_callout_box(
        "SYSTEM SCOPE & INTELLECTUAL PROPERTY NOTICE",
        "This document provides the authoritative, exhaustive technical and functional specification for CRM Lite. "
        "It catalogs all user-facing capabilities, artificial intelligence pipelines, REST endpoints, data validations, "
        "and security protocols active in the production codebase.",
        callout_type="info",
        width=PAGE_WIDTH
    ))

    story.append(PageBreak())

    # ==================================================================
    # TABLE OF CONTENTS
    # ==================================================================
    story.append(Paragraph("Table of Contents", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=10))

    toc_items = [
        ("1. Executive Summary & Complete Feature Ecosystem", "High-level mission, value drivers, and master feature matrix"),
        ("2. Feature 1: 360° Lead Management & Dossier", "Lead lifecycle, scoring, multi-channel sourcing, duplicate detection, conversion"),
        ("3. Feature 2: Interactive Visual Sales Pipeline (Kanban)", "7-stage pipeline, drag-and-drop progression, column value aggregation, filtering"),
        ("4. Feature 3: Smart Follow-Up & Appointment Engine", "Scheduling engine, anti-past date validation, overdue alerts, completion logs"),
        ("5. Feature 4: Interactive Sales Calendar & Scheduling Hub", "Month/Week/Day calendar views, color-coded appointments, modal quick-actions"),
        ("6. Feature 5: Converted Customer Directory & Account Management", "Atomic conversion, customer profile, historical lineage, lifetime value tracking"),
        ("7. Feature 6: Next-Gen Artificial Intelligence (AI) Suite", "Speech-to-Text call summaries, CRM Copilot chatbot, Lead Dossier synthesis"),
        ("8. Feature 7: Team Collaboration & Internal Mentions", "Internal private notes, @user mentions autocomplete, team communication alerts"),
        ("9. Feature 8: Notification & Real-Time Alert Engine", "In-app notification bell, responsive HTML emails, priority triggers, anti-self alerts"),
        ("10. Feature 9: Real-Time KPI Dashboards & Reporting", "Zero-hardcoded dynamic analytics, rep scorecards, funnel charts, streaming CSV"),
        ("11. Feature 10: Enterprise Security & Role-Based Access (RBAC)", "3-tier role governance, permission matrix, JWT rotation, data isolation"),
        ("12. Feature 11: System Architecture, REST APIs & Microservices", "Dual-backend architecture, FastAPI search, full REST endpoint catalogue"),
        ("13. Feature 12: Modern UI/UX Design System", "Vanilla CSS dark glassmorphism, responsive grids, Outfit/Jakarta typography"),
        ("14. Verification, Test Coverage & Setup Appendix", "Automated test suite, zero-config local run commands, developer cheatsheet"),
    ]

    toc_data = []
    for num_title, desc in toc_items:
        toc_data.append([
            Paragraph(f"<b>{num_title}</b>", tb_bold),
            Paragraph(desc, tb_style)
        ])

    toc_table = Table(toc_data, colWidths=[204, 300])
    toc_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
    ]))
    story.append(toc_table)
    story.append(Spacer(1, 14))

    # ==================================================================
    # SECTION 1: EXECUTIVE SUMMARY & FEATURE ECOSYSTEM
    # ==================================================================
    story.append(Paragraph("1. Executive Summary & Complete Feature Ecosystem", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=8))
    
    story.append(Paragraph(
        "<b>CRM Lite</b> is a unified sales operations and lead management platform engineered for fast-moving enterprise sales "
        "teams. The system eliminates manual sales friction, accelerates deal velocity, enforces operational rigor, and unlocks "
        "generative AI capabilities across customer interactions.",
        body_style
    ))
    story.append(Paragraph(
        "Unlike legacy CRM platforms burdened with bloated plugins and prohibitive licensing costs, CRM Lite delivers a responsive, "
        "modern single-page application (React 19) backed by high-throughput Django REST Framework endpoints and an optional FastAPI "
        "federated search engine. Every feature—from atomic customer conversions to multimodal call transcriptions—is built "
        "with transactional safety, rigorous access controls, and zero hardcoded metrics.",
        body_style
    ))

    # Master Ecosystem Grid
    story.append(Paragraph("<b>Master CRM Feature Ecosystem Matrix</b>", h3_style))
    eco_headers = [Paragraph("<b>Module / Domain</b>", th_style), Paragraph("<b>Key Capabilities</b>", th_style), Paragraph("<b>Primary Benefit</b>", th_style)]
    eco_rows = [
        [
            Paragraph("<b>Lead Management & 360° View</b>", tb_bold),
            Paragraph("Full lifecycle tracking, priority scoring, multi-channel sourcing, duplicate warning, loss reason attribution, chronological activity audit trail.", tb_style),
            Paragraph("Complete visibility into prospect history and eliminated lead attrition.", tb_style)
        ],
        [
            Paragraph("<b>Visual Sales Pipeline</b>", tb_bold),
            Paragraph("7-stage interactive Kanban board, real-time stage currency valuation, deal counter, drag-and-drop movement, rep/priority filtering.", tb_style),
            Paragraph("Clear operational funnel forecasting and accelerated deal progression.", tb_style)
        ],
        [
            Paragraph("<b>Smart Follow-Ups</b>", tb_bold),
            Paragraph("Automated overdue detection engine, anti-past scheduling validation, 'Due Today' hub, outcome completion logging.", tb_style),
            Paragraph("Zero missed follow-up deadlines; strict rep accountability.", tb_style)
        ],
        [
            Paragraph("<b>Sales Calendar</b>", tb_bold),
            Paragraph("Month/Week/Day scheduling layouts, color-coded task cards, direct event booking, quick completion modals.", tb_style),
            Paragraph("Holistic time management and seamless appointment tracking.", tb_style)
        ],
        [
            Paragraph("<b>Customer Accounts</b>", tb_bold),
            Paragraph("Atomic lead conversion inside <code>transaction.atomic()</code>, linked original lead lineage, Lifetime Value (LTV) metrics.", tb_style),
            Paragraph("Clean separation between prospect pipeline and paying accounts.", tb_style)
        ],
        [
            Paragraph("<b>AI Call Deal Intelligence</b>", tb_bold),
            Paragraph("In-browser audio recorder, multi-format audio upload (up to 25MB), Gemini 2.5 Flash native transcription, structured intent/objection extraction.", tb_style),
            Paragraph("Automated CRM call note logging; hours of manual data entry saved.", tb_style)
        ],
        [
            Paragraph("<b>Conversational CRM Copilot</b>", tb_bold),
            Paragraph("Slide-out drawer chatbot grounded in live DB data with confirmation cards for safe write actions (lead creation, follow-ups).", tb_style),
            Paragraph("Instant natural-language queries and guided sales workflows.", tb_style)
        ],
        [
            Paragraph("<b>Team Collaboration</b>", tb_bold),
            Paragraph("Internal private team notes, <code>@username</code> mentions autocomplete, real-time trigger notifications.", tb_style),
            Paragraph("Seamless handoffs and transparent deal collaboration.", tb_style)
        ],
        [
            Paragraph("<b>Notification Engine</b>", tb_bold),
            Paragraph("In-app notification bell with unread badge + responsive HTML transactional emails for stage changes, assignments, and overdues.", tb_style),
            Paragraph("Real-time awareness across reps and managers on critical events.", tb_style)
        ],
        [
            Paragraph("<b>Real-Time Analytics</b>", tb_bold),
            Paragraph("Zero hardcoded stats: win rates, pipeline value, monthly trends, rep performance scorecards, and streaming CSV downloads.", tb_style),
            Paragraph("Executive-level visibility into conversion velocity and rep ROI.", tb_style)
        ]
    ]

    eco_table = Table([eco_headers] + eco_rows, colWidths=[110, 244, 150])
    eco_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(eco_table)

    story.append(PageBreak())

    # ==================================================================
    # SECTION 2: 360° LEAD MANAGEMENT & DOSSIER
    # ==================================================================
    story.append(Paragraph("2. Feature 1: 360° Lead Management & Dossier", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "Lead management represents the foundational core of CRM Lite. Every prospect is represented by an exhaustive data record "
        "capturing contact coordinates, commercial attributes, interaction histories, and predictive indicators.",
        body_style
    ))

    story.append(Paragraph("<b>2.1. Lead Attributes & Schema Specifications</b>", h2_style))
    story.append(Paragraph("Each lead record incorporates the following normalized attributes:", body_style))

    lead_attrs = [
        ("Identity & Contact", "Full Name, Corporate Email Address, Direct Phone / Mobile Number, Organization / Company Name, Job Title, Industry Sector."),
        ("Pipeline Metrics", "Estimated Deal Value (Numeric Currency), Win Probability % (0–100 slider), Expected Close Date, Priority Tier (LOW, MEDIUM, HIGH, URGENT)."),
        ("Source Attribution", "Ingestion channel attribution: <code>WEBSITE</code>, <code>LINKEDIN</code>, <code>REFERRAL</code>, <code>COLD_OUTREACH</code>, <code>TRADE_SHOW</code>, <code>WEBINAR</code>, <code>OTHER</code>."),
        ("Ownership & Status", "Current Pipeline Stage (NEW through WON/LOST), Assigned Representative (User Foreign Key), Lead Qualification Score (0–100 integer)."),
        ("Audit Metadata", "Created By User, Created Timestamp, Last Updated Timestamp, Handover / Assignment Timestamp.")
    ]
    lead_attr_table = Table([[Paragraph(f"<b>{k}</b>", tb_bold), Paragraph(v, tb_style)] for k, v in lead_attrs], colWidths=[130, 374])
    lead_attr_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(lead_attr_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>2.2. Duplicate Lead Warning Engine</b>", h2_style))
    story.append(Paragraph(
        "To prevent duplicate outreach and sales rep collisions, the system monitors incoming lead creation requests. "
        "If a prospective lead matches an existing email address or phone number, the frontend surfaces an intelligent duplicate warning banner "
        "linking directly to the existing lead record, while the backend creates a <code>DUPLICATE_WARNING</code> notification for management review.",
        body_style
    ))

    story.append(Paragraph("<b>2.3. Multi-Channel Interaction Logging & Activity Timeline</b>", h2_style))
    story.append(Paragraph(
        "Every interaction with a prospect is chronologically logged into the immutable <code>ActivityLog</code> timeline. Sales reps can categorize "
        "interactions using structured types:",
        body_style
    ))

    types_data = [
        [Paragraph("<b>Channel Type</b>", th_style), Paragraph("<b>Use Case</b>", th_style), Paragraph("<b>Timeline Representation</b>", th_style)],
        [Paragraph("<b>CALL</b>", tb_bold), Paragraph("Inbound or outbound telephone conversation", tb_style), Paragraph("Phone receiver badge, call duration, summary", tb_style)],
        [Paragraph("<b>WHATSAPP</b>", tb_bold), Paragraph("Direct instant messaging exchange", tb_style), Paragraph("Chat bubble badge, message excerpt, next response date", tb_style)],
        [Paragraph("<b>EMAIL</b>", tb_bold), Paragraph("Written correspondence or quote dispatch", tb_style), Paragraph("Mail envelope badge, subject line, deliverability", tb_style)],
        [Paragraph("<b>MEETING</b>", tb_bold), Paragraph("Face-to-face or video conference conference", tb_style), Paragraph("Calendar badge, attendee list, meeting minutes", tb_style)],
        [Paragraph("<b>DEMO</b>", tb_bold), Paragraph("Formal solution demonstration or proof-of-concept", tb_style), Paragraph("Monitor badge, feature feedback, technical objections", tb_style)],
        [Paragraph("<b>OBJECTION</b>", tb_bold), Paragraph("Specific prospect reservation (budget, timing, competitor)", tb_style), Paragraph("Warning shield badge, objection category, counter-strategy", tb_style)],
        [Paragraph("<b>GENERAL</b>", tb_bold), Paragraph("Internal administrative note or desk research", tb_style), Paragraph("Note page badge, research links, account updates", tb_style)],
    ]
    types_table = Table(types_data, colWidths=[90, 230, 184])
    types_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_DARK),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(types_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>2.4. Mandatory Loss Reason Attribution</b>", h2_style))
    story.append(Paragraph(
        "When a deal moves into the <code>LOST</code> terminal stage, CRM Lite displays the <code>LostReasonModal</code>. "
        "Sales reps cannot disqualify a deal without selecting a structured root-cause category (e.g., <i>Budget Constraints, Competitor Selection, "
        "Feature Gap, Poor Timing, Unresponsive Prospect</i>) and documenting a detailed post-mortem note. "
        "This data feeds directly into the executive win/loss analytics engine.",
        body_style
    ))

    story.append(Paragraph("<b>2.5. Atomic Customer Conversion Engine</b>", h2_style))
    story.append(Paragraph(
        "When a deal is marked <code>WON</code> or reaches final agreement, Managers and Admins can convert the lead into an official Customer. "
        "This operation executes within a strict <code>django.db.transaction.atomic()</code> boundary to guarantee ACID database consistency:",
        body_style
    ))

    story.append(create_callout_box(
        "TRANSACTIONAL CONVERSION PROTOCOL (transaction.atomic())",
        "1. Validates that the lead is not already converted (prevents double-conversion idempotency errors).<br/>"
        "2. Spawns a new <code>Customer</code> entity with company details, lifetime value, and original lead foreign key.<br/>"
        "3. Sets lead status to <code>WON</code>, sets <code>is_converted=True</code>, and records conversion timestamp.<br/>"
        "4. Seamlessly re-links all historical activity logs, communication notes, and call recordings to the customer profile.<br/>"
        "5. Dispatches in-app notification and email confirmation to the account owner.",
        callout_type="success",
        width=PAGE_WIDTH
    ))

    story.append(PageBreak())

    # ==================================================================
    # SECTION 3: VISUAL SALES PIPELINE (KANBAN BOARD)
    # ==================================================================
    story.append(Paragraph("3. Feature 2: Interactive Visual Sales Pipeline (Kanban)", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "The Visual Pipeline transforms linear database queries into an intuitive, multi-column Kanban board allowing sales reps "
        "and executives to grasp pipeline health at a glance. Every deal is rendered as a responsive card displaying prospect details, "
        "deal value, priority badges, next follow-up dates, and assigned rep avatars.",
        body_style
    ))

    story.append(Paragraph("<b>3.1. The 7-Stage Sales Lifecycle Funnel</b>", h2_style))
    
    stages_data = [
        [Paragraph("<b>Pipeline Stage</b>", th_style), Paragraph("<b>Key Stage Objective</b>", th_style), Paragraph("<b>Automated Action / Trigger</b>", th_style)],
        [
            Paragraph("<b>1. NEW</b>", tb_bold),
            Paragraph("Raw incoming prospect awaiting initial qualification and rep assignment.", tb_style),
            Paragraph("Auto-notifies sales manager of unassigned deal; prompts priority triage.", tb_style)
        ],
        [
            Paragraph("<b>2. CONTACTED</b>", tb_bold),
            Paragraph("First outreach attempted via telephone, LinkedIn, or personalized email.", tb_style),
            Paragraph("Enforces follow-up scheduling within 48 hours to maintain momentum.", tb_style)
        ],
        [
            Paragraph("<b>3. DEMO_SCHEDULED</b>", tb_bold),
            Paragraph("Formal product walk-through or discovery session locked in calendar.", tb_style),
            Paragraph("Syncs to Sales Calendar; sends calendar invite reminders.", tb_style)
        ],
        [
            Paragraph("<b>4. NEGOTIATION</b>", tb_bold),
            Paragraph("Commercial quote or contract presented; commercial pricing under review.", tb_style),
            Paragraph("Flags deal as high-priority in dashboard forecast; tracks objection logs.", tb_style)
        ],
        [
            Paragraph("<b>5. QUALIFIED</b>", tb_bold),
            Paragraph("Budget confirmed, decision maker committed, final legal/security review.", tb_style),
            Paragraph("Unlocks 1-click 'Convert to Customer' action for managers.", tb_style)
        ],
        [
            Paragraph("<b>6. WON</b>", tb_bold),
            Paragraph("Contract executed, payment initiated, commercial victory achieved.", tb_style),
            Paragraph("Dispatches celebratory email alert; updates rep quota scorecards.", tb_style)
        ],
        [
            Paragraph("<b>7. LOST</b>", tb_bold),
            Paragraph("Prospect disqualified or chose competitor; terminal sales outcome.", tb_style),
            Paragraph("Opens <code>LostReasonModal</code> to record mandatory attribution data.", tb_style)
        ],
    ]
    stages_table = Table(stages_data, colWidths=[100, 214, 190])
    stages_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(stages_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>3.2. Real-Time Column Value & Deal Aggregation</b>", h2_style))
    story.append(Paragraph(
        "Each stage column header dynamically calculates and displays two critical metrics in real time:<br/>"
        "• <b>Deal Counter:</b> Total active prospects residing in this stage.<br/>"
        "• <b>Aggregate Stage Currency:</b> Summed estimated deal value (e.g. <i>$148,500.00</i>), updated instantly upon card movement.",
        body_style
    ))

    story.append(Paragraph("<b>3.3. Multi-Parameter Pipeline Filtering</b>", h2_style))
    story.append(Paragraph(
        "Sales reps and managers can filter the entire Kanban board instantaneously without page reloads using:<br/>"
        "• <b>Assigned Sales Rep:</b> Filter by specific team member or view unassigned leads.<br/>"
        "• <b>Priority Tier:</b> Isolate URGENT and HIGH priority deals requiring immediate closing action.<br/>"
        "• <b>Time Window:</b> Filter by leads created this week, this month, or this quarter.<br/>"
        "• <b>Search Keyword:</b> Live fuzzy matching against prospect name, organization, or email.",
        body_style
    ))

    story.append(PageBreak())

    # ==================================================================
    # SECTION 4: SMART FOLLOW-UP ENGINE & CALENDAR
    # ==================================================================
    story.append(Paragraph("4. Feature 3 & 4: Follow-Up Engine & Sales Calendar", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "In enterprise B2B sales, deal velocity is governed by rigorous follow-up cadence. "
        "CRM Lite replaces scattered calendar reminders with a centralized, rules-enforced Follow-Up Engine and Interactive Sales Calendar.",
        body_style
    ))

    story.append(Paragraph("<b>4.1. Strict Follow-Up Validation & Anti-Past Scheduling Rules</b>", h2_style))
    story.append(Paragraph(
        "To ensure sales data integrity, both frontend forms and backend serializers enforce strict temporal validation. "
        "The system strictly prohibits scheduling follow-up appointments in the past: <code>scheduled_time >= timezone.now()</code>. "
        "Attempts to submit a past timestamp immediately trigger a descriptive 400 Bad Request error.",
        body_style
    ))

    story.append(Paragraph("<b>4.2. Automated Overdue Follow-Up Engine</b>", h2_style))
    story.append(Paragraph(
        "The follow-up engine continuously evaluates open tasks against the current system time. Tasks where <code>scheduled_time < now()</code> "
        "and <code>status == 'PENDING'</code> are automatically elevated:<br/>"
        "• <b>Visual Overdue Badging:</b> Marked with high-contrast red warning badges and elapsed time tags (e.g., <i>'3 days overdue'</i>).<br/>"
        "• <b>Dashboard KPI Counter:</b> Increments the executive 'Overdue Tasks' alert widget.<br/>"
        "• <b>Notification Trigger:</b> Sends in-app reminders to both the assigned sales rep and their sales manager.",
        body_style
    ))

    story.append(Paragraph("<b>4.3. 'Due Today' Action Hub & Completion Workflow</b>", h2_style))
    story.append(Paragraph(
        "Upon logging in, sales reps are greeted with the 'Due Today' queue. Completing a follow-up requires structured accountability:<br/>"
        "1. Rep clicks <b>'Complete Follow-up'</b>.<br/>"
        "2. A modal prompts for mandatory <b>Outcome Notes</b> (what occurred during the interaction).<br/>"
        "3. Rep records the interaction result (e.g., <i>'Client requested formal quote'</i> or <i>'Decision maker out of office'</i>).<br/>"
        "4. The system prompts to optionally schedule the next follow-up appointment in one continuous flow.",
        body_style
    ))

    story.append(Paragraph("<b>4.4. Interactive Sales Calendar Hub</b>", h2_style))
    story.append(Paragraph(
        "The Sales Calendar page (<code>Calendar.jsx</code>) provides a comprehensive scheduling cockpit featuring:<br/>"
        "• <b>Multi-View Modes:</b> Seamlessly toggle between Month, Week, and Day layouts.<br/>"
        "• <b>Color-Coded Event Cards:</b> Distinct palette identifying Calls (Teal), Meetings (Sky Blue), Demos (Purple), and Urgent Tasks (Rose).<br/>"
        "• <b>Direct In-Calendar Booking:</b> Click any open time slot to open the scheduling modal with pre-filled datetime.<br/>"
        "• <b>1-Click Record Navigation:</b> Click any event card to view the associated prospect dossier or mark the task complete.",
        body_style
    ))

    # Calendar & Follow-up Feature Table
    fu_table_data = [
        [Paragraph("<b>Component</b>", th_style), Paragraph("<b>Key Functional Capability</b>", th_style), Paragraph("<b>Business Value</b>", th_style)],
        [
            Paragraph("<b>FollowUps.jsx</b>", tb_bold),
            Paragraph("Filterable task table with tabs for Overdue, Today, Upcoming, and Completed tasks.", tb_style),
            Paragraph("Ensures reps never lose track of a commitment or prospect touchpoint.", tb_style)
        ],
        [
            Paragraph("<b>Calendar.jsx</b>", tb_bold),
            Paragraph("Full visual calendar grid with drag navigation, date jump, and event density indicators.", tb_style),
            Paragraph("Prevents double-booking and optimizes sales call scheduling.", tb_style)
        ],
        [
            Paragraph("<b>CalendarScheduleModal</b>", tb_bold),
            Paragraph("Integrated booking drawer linking lead records, contact methods, and priority flags.", tb_style),
            Paragraph("Sub-minute scheduling workflow directly from calendar view.", tb_style)
        ]
    ]
    fu_table = Table(fu_table_data, colWidths=[110, 244, 150])
    fu_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_DARK),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(fu_table)

    story.append(PageBreak())

    # ==================================================================
    # SECTION 5: CONVERTED CUSTOMER MANAGEMENT
    # ==================================================================
    story.append(Paragraph("5. Feature 5: Converted Customer Directory & Accounts", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "A critical architectural principle of CRM Lite is the strict operational boundary between <i>Sales Prospects</i> (unconverted leads) "
        "and <i>Paying Customers</i>. Once a lead is converted, they graduate from the transient sales pipeline into the persistent Customer Directory.",
        body_style
    ))

    story.append(Paragraph("<b>5.1. Customer 360° Profile & Account Record</b>", h2_style))
    story.append(Paragraph(
        "The Customer record (<code>customers/models.py</code> and <code>CustomerDetails.jsx</code>) preserves full institutional knowledge:<br/>"
        "• <b>Primary Coordinates:</b> Company Name, Primary Contact Person, Direct Email, Phone, Office Address, Industry.<br/>"
        "• <b>Original Lead Lineage:</b> Unbroken foreign key link to the originating <code>Lead</code> entity, recording original source, initial inquiry date, and conversion duration.<br/>"
        "• <b>Lifetime Value (LTV) Metrics:</b> Tracks total closed contract value, ongoing subscription tier, and contract renewal dates.<br/>"
        "• <b>Preserved Interaction Archive:</b> Full access to historical pre-conversion notes, call audio summaries, objection logs, and emails.",
        body_style
    ))

    story.append(Paragraph("<b>5.2. Customer Account Directory Features</b>", h2_style))
    story.append(Paragraph(
        "The Customer Directory page (<code>Customers.jsx</code>) provides enterprise account management tools:<br/>"
        "• <b>Instant Account Search:</b> Real-time filtering by company name, contact person, or corporate email.<br/>"
        "• <b>Account Status Filters:</b> Segment customers by Active, Onboarding, In-Renewal, or Past-Due.<br/>"
        "• <b>LTV Sorting:</b> Rank accounts by financial value to support executive customer success triage.",
        body_style
    ))

    story.append(Spacer(1, 10))

    # ==================================================================
    # SECTION 6: ARTIFICIAL INTELLIGENCE (AI) SUITE
    # ==================================================================
    story.append(Paragraph("6. Feature 6: Cutting-Edge Artificial Intelligence (AI) Suite", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "CRM Lite implements a state-of-the-art enterprise AI subsystem powered by Google Gemini 2.5 Flash. "
        "Rather than superficial chatbot wrappers, the AI architecture is deeply integrated into operational workflows: "
        "transcribing audio sales calls, grounding conversational queries in live CRM data, and synthesizing executive dossiers.",
        body_style
    ))

    story.append(create_callout_box(
        "DECOUPLED AI PROVIDER ARCHITECTURE (ai_provider.py)",
        "The backend uses an abstract base provider (<code>BaseAIProvider</code>) pattern. All LLM calls pass through standardized contracts "
        "(<code>transcribe_audio</code>, <code>summarize_call</code>, <code>chat</code>). Google GenAI (<code>gemini-2.5-flash</code>) is the primary "
        "production implementation. The architecture allows swapping in Anthropic Claude, OpenAI, or local Ollama models by registering "
        "new providers in the factory without altering any view or controller logic.",
        callout_type="ai",
        width=PAGE_WIDTH
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>6.1. Multimodal Speech-to-Text & Call Deal Intelligence</b>", h2_style))
    story.append(Paragraph(
        "Eliminates hours of manual data entry by extracting verified deal intelligence directly from audio sales call recordings:",
        body_style
    ))

    call_steps = [
        ("In-Browser Audio Recording", "The <code>AudioRecorder</code> component captures real-time microphone streams via the browser <code>navigator.mediaDevices.getUserMedia</code> API in <code>audio/webm</code> format with active waveform visualizations and duration timers."),
        ("Multi-Format Audio Upload", "Accepts pre-recorded sales call files (<code>.mp3</code>, <code>.wav</code>, <code>.m4a</code>, <code>.webm</code>, <code>.ogg</code>, <code>.aac</code>) up to 25MB with strict MIME-type and size validation in <code>TranscriptionService</code>."),
        ("Direct Multimodal Processing", "Submits raw audio bytes directly to Gemini 2.5 Flash using <code>types.Part.from_bytes()</code>. Bypasses third-party speech-to-text intermediaries, dramatically reducing latency and transcription error rates."),
        ("Structured Deal Extraction", "Guided by a strict system prompt and schema, the model outputs structured JSON with zero markdown hallucination containing: verbatim dialogue transcript, 2-sentence executive summary, customer intent, detected objections, overall sentiment, stage recommendations, and actionable next steps."),
        ("1-Click CRM Synchronization", "From the call intelligence page, reps can link the call to an existing lead, update pipeline stage, and append extracted action items directly to the lead's activity timeline with a single click.")
    ]
    call_table = Table([[Paragraph(f"<b>{k}</b>", tb_bold), Paragraph(v, tb_style)] for k, v in call_steps], colWidths=[130, 374])
    call_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(call_table)

    story.append(PageBreak())

    # Continuing AI Section
    story.append(Paragraph("<b>6.2. Conversational CRM AI Copilot (Slide-out Assistant Drawer)</b>", h2_style))
    story.append(Paragraph(
        "Available from any screen via the floating sparkle button or navigation header, the AI Assistant Drawer (<code>AiAssistantDrawer.jsx</code>) "
        "delivers a live conversational copilot grounded directly in the user's CRM database.",
        body_style
    ))

    story.append(Paragraph(
        "<b>Live Database Grounding:</b> When a query is submitted, <code>CRMTools</code> extracts authenticated user context—active leads, "
        "assigned pipeline values, overdue follow-ups, and customer metrics—and injects this structured context into the system prompt. "
        "The model cannot invent fake leads or hallucinate deal numbers.",
        body_style
    ))

    story.append(Paragraph(
        "<b>Safe Action Execution (Human-in-the-Loop Protocol):</b> The Copilot can assist with write operations, but strictly adheres "
        "to a two-phase confirmation protocol:",
        body_style
    ))

    story.append(create_callout_box(
        "COPILOT ACTION CONFIRMATION PROTOCOL",
        "1. <b>Draft Phase:</b> When the user asks <i>'Schedule a follow-up with Acme Corp tomorrow at 2 PM'</i>, the AI returns a structured "
        "<code>pending_action</code> object specifying action type (<code>schedule_followup</code>, <code>create_lead</code>, <code>update_stage</code>) "
        "and payload parameters.<br/>"
        "2. <b>Interactive UI Card:</b> The frontend renders an interactive confirmation card detailing the exact entity, date, and changes.<br/>"
        "3. <b>Human Execution:</b> The database mutation is executed ONLY when the user clicks 'Confirm & Execute'. If rejected, the draft is discarded.",
        callout_type="security",
        width=PAGE_WIDTH
    ))
    story.append(Spacer(1, 6))

    story.append(Paragraph("<b>6.3. Lead Dossier AI Synthesis & Prescriptive Recommendations</b>", h2_style))
    story.append(Paragraph(
        "From the Lead Details screen, sales reps can click <b>'Generate AI Briefing'</b>. "
        "The backend aggregates the prospect's entire timeline—every interaction note, stage transition, call summary, and follow-up outcome—and "
        "prompts Gemini 2.5 Flash (temperature 0.2) to synthesize an executive dossier containing:<br/>"
        "• <b>Executive Synthesis:</b> A 3-sentence summary of the prospect's organizational needs and commercial relationship.<br/>"
        "• <b>Win Probability Breakdown:</b> Data-driven factors impacting deal success.<br/>"
        "• <b>Key Objections Matrix:</b> Unresolved technical, pricing, or organizational blockers.<br/>"
        "• <b>Prescriptive Next Actions:</b> Highly specific tactical recommendations to advance the deal to the next pipeline stage.",
        body_style
    ))

    story.append(Paragraph("<b>6.4. Dynamic Environment Hot-Reloading</b>", h2_style))
    story.append(Paragraph(
        "To maximize development velocity and prevent downtime, <code>GeminiProvider._resolve_api_key()</code> includes a dynamic environment "
        "reloader. If an administrator updates the Gemini API key in the Settings page or edits <code>backend/.env</code>, "
        "the AI provider detects the change on the fly without requiring a server reboot.",
        body_style
    ))

    story.append(Paragraph("<b>6.5. Central AI Operations Center (AiCenter.jsx)</b>", h2_style))
    story.append(Paragraph(
        "The dedicated AI Center acts as the operational command dashboard for generative features. Sales leaders can inspect:<br/>"
        "• <b>Live Provider Status:</b> Verifies connectivity with Google GenAI / Gemini 2.5 Flash.<br/>"
        "• <b>Feature Launchers:</b> Direct 1-click launchpad for Call Deal Intelligence, Copilot Assistant Drawer, and Lead Synthesis.<br/>"
        "• <b>Token & Usage Metrics:</b> Visual indicators tracking daily audio transcriptions and copilot query volumes.",
        body_style
    ))

    story.append(Paragraph("<b>6.6. AI Configuration & Model Tunables (Settings.jsx)</b>", h2_style))
    story.append(Paragraph(
        "Administrators can adjust AI parameters directly from the UI Settings page:<br/>"
        "• <b>Secure Key Storage:</b> Enter or rotate Google Gemini API keys with input masking.<br/>"
        "• <b>Temperature Sliders:</b> Calibrate model creativity vs. strict grounding (0.2 for call summaries; 0.3 for chatbot).<br/>"
        "• <b>Model Selection:</b> Switch between <code>gemini-2.5-flash</code> (low latency) and <code>gemini-1.5-pro</code> for deep analysis.",
        body_style
    ))

    story.append(Spacer(1, 10))

    # ==================================================================
    # SECTION 7: TEAM COLLABORATION & INTERNAL MENTIONS
    # ==================================================================
    story.append(Paragraph("7. Feature 7: Team Collaboration & Internal Mentions", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "Complex enterprise deals require cross-functional teamwork between reps, sales engineers, and managers. "
        "CRM Lite includes a specialized Internal Comments & Mentions system (<code>InternalCommentsSection.jsx</code> and <code>MentionInput.jsx</code>).",
        body_style
    ))

    story.append(Paragraph(
        "• <b>Private Team Comments:</b> Distinguishes internal strategy remarks from official prospect communication logs. Internal comments are never visible to external contacts.<br/>"
        "• <b>Dynamic @User Mention Autocomplete:</b> Typing <code>@</code> in any comment box triggers an instant dropdown matching active sales team members.<br/>"
        "• <b>Instant Alert Dispatch:</b> Tagging a colleague automatically dispatches an <code>INTERNAL_MENTION</code> in-app notification linking directly to the comment.<br/>"
        "• <b>Handoff Auditability:</b> Enables sales managers to leave strategic instructions during deal reassignment.",
        body_style
    ))

    story.append(PageBreak())

    # ==================================================================
    # SECTION 8: NOTIFICATION & ALERT ENGINE
    # ==================================================================
    story.append(Paragraph("8. Feature 8: Notification & Real-Time Alert Engine", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "CRM Lite features a dual-channel notification architecture: a real-time In-App Notification Center paired with an "
        "automated transactional HTML Email Dispatcher.",
        body_style
    ))

    story.append(Paragraph("<b>8.1. In-App Notification Center</b>", h2_style))
    story.append(Paragraph(
        "Located in the top navigation bar (<code>NotificationBell.jsx</code> & <code>NotificationDropdown.jsx</code>):<br/>"
        "• <b>Live Unread Badge:</b> Displays a counter of unread alerts, updating dynamically upon event dispatch.<br/>"
        "• <b>Priority Color Indicators:</b> Categorized by priority tiers: <code>LOW</code>, <code>NORMAL</code>, <code>HIGH</code>, and <code>URGENT</code>.<br/>"
        "• <b>1-Click Entity Navigation:</b> Clicking an alert marks it as read and immediately routes the user to the related Lead, Customer, or Follow-up.<br/>"
        "• <b>Batch Management:</b> Includes 'Mark All as Read' and filtered views for unread vs. historical alerts.",
        body_style
    ))

    story.append(Paragraph("<b>8.2. Automated Transactional HTML Email System</b>", h2_style))
    story.append(Paragraph(
        "Critical business events trigger high-deliverability transactional emails formatted using modern, responsive HTML templates "
        "(e.g., <code>lead_stage_updated.html</code>):",
        body_style
    ))

    email_events = [
        [Paragraph("<b>Business Event Trigger</b>", th_style), Paragraph("<b>Recipient</b>", th_style), Paragraph("<b>Email Template & Content</b>", th_style)],
        [
            Paragraph("<b>Lead Stage Transition</b>", tb_bold),
            Paragraph("Assigned Sales Rep & Sales Manager", tb_style),
            Paragraph("Branded HTML notification detailing old vs. new stage, deal value, and next recommended action.", tb_style)
        ],
        [
            Paragraph("<b>Lead Assignment / Handover</b>", tb_bold),
            Paragraph("Newly Assigned Sales Rep", tb_style),
            Paragraph("Welcome briefing containing prospect contact info, lead source, priority, and previous rep notes.", tb_style)
        ],
        [
            Paragraph("<b>Follow-up Overdue Alert</b>", tb_bold),
            Paragraph("Assigned Rep & Escalated to Manager", tb_style),
            Paragraph("Urgent reminder highlighting elapsed deadline, prospect value, and direct link to complete task.", tb_style)
        ],
        [
            Paragraph("<b>Customer Converted</b>", tb_bold),
            Paragraph("All Team Members & Management", tb_style),
            Paragraph("Commercial victory alert celebrating closed deal, converted revenue, and customer onboarding link.", tb_style)
        ]
    ]
    email_table = Table(email_events, colWidths=[120, 140, 244])
    email_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(email_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>8.3. Anti-Self-Notification Filtering</b>", h2_style))
    story.append(Paragraph(
        "To prevent notification noise, <code>NotificationService</code> enforces a strict anti-self-notification guard: "
        "if an action is performed by User A (e.g. User A updates a stage or marks a follow-up complete), the service automatically suppresses "
        "sending User A a notification for their own action.",
        body_style
    ))

    story.append(Paragraph("<b>8.4. Real Email SMTP Testing & Diagnostics (check_email.py)</b>", h2_style))
    story.append(Paragraph(
        "To guarantee 100% email deliverability in production, the backend includes an automated diagnostic CLI tool:<br/>"
        "• <b>Verification Command:</b> Run <code>python backend/check_email.py [recipient_email]</code>.<br/>"
        "• <b>Pre-Flight Checks:</b> Verifies TLS port 587 connectivity, credentials syntax, and Google 16-character App Passwords.<br/>"
        "• <b>Instant Test Dispatch:</b> Sends a verified end-to-end test message to confirm inbox delivery and spam filter bypass.",
        body_style
    ))

    story.append(Spacer(1, 10))

    # ==================================================================
    # SECTION 9: REAL-TIME KPI DASHBOARDS & REPORTING
    # ==================================================================
    story.append(Paragraph("9. Feature 9: Real-Time KPI Dashboards & Analytics", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "A standout architectural achievement of CRM Lite is that <b>zero analytics metrics are hardcoded</b>. "
        "Every KPI card, conversion ratio, pipeline valuation, and monthly chart aggregates live database records in real time.",
        body_style
    ))

    story.append(Paragraph("<b>9.1. Executive KPI Dashboard Widgets</b>", h2_style))
    story.append(Paragraph(
        "The Dashboard (<code>Dashboard.jsx</code>) renders six live metrics updating dynamically on data change:<br/>"
        "• <b>Total Active Leads:</b> Total count of in-flight prospects currently progressing through the sales pipeline.<br/>"
        "• <b>Converted Customers:</b> Total official customer accounts created through the atomic conversion engine.<br/>"
        "• <b>Overall Win / Conversion Rate %:</b> Calculated dynamically as <code>(Converted Leads / Total Finished Leads) * 100</code>.<br/>"
        "• <b>Estimated Pipeline Value:</b> Sum of estimated values across all open deals (formatted in international currency).<br/>"
        "• <b>Overdue Follow-up Alert:</b> High-priority counter reflecting past-due tasks requiring immediate escalation.<br/>"
        "• <b>Monthly Inflow Trend:</b> Time-series aggregation showing new prospects acquired month-over-month.",
        body_style
    ))

    story.append(Paragraph("<b>9.2. Sales Representative Performance Scorecard</b>", h2_style))
    story.append(Paragraph(
        "The Reports module (<code>Reports.jsx</code>) provides granular rep-by-rep performance evaluation: total leads handled, "
        "deals won, deals lost, individual conversion percentages, and total closed contract value.",
        body_style
    ))

    story.append(Paragraph("<b>9.3. High-Performance Streaming CSV Export Engine</b>", h2_style))
    story.append(Paragraph(
        "Managers and Admins can export filtered CRM records at any time. Rather than buffering large datasets in memory, "
        "the backend implements Django <code>StreamingHttpResponse</code> to stream CSV rows directly to the client browser, "
        "preventing memory spikes even with tens of thousands of records.",
        body_style
    ))

    story.append(PageBreak())

    # ==================================================================
    # SECTION 10: ENTERPRISE SECURITY & RBAC
    # ==================================================================
    story.append(Paragraph("10. Feature 10: Security, RBAC & Authentication", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "CRM Lite enforces strict Role-Based Access Control (RBAC) across three distinct tiers. "
        "Security is enforced at the database query level (scoping QuerySets in DRF viewsets), controller permission classes, "
        "and client-side route guards (<code>RoleGuard.jsx</code>).",
        body_style
    ))

    # Comprehensive RBAC Matrix
    rbac_headers = [
        Paragraph("<b>Feature / Operational Capability</b>", th_style),
        Paragraph("<b>Admin / Mentor</b>", th_style),
        Paragraph("<b>Sales Manager</b>", th_style),
        Paragraph("<b>Sales Executive</b>", th_style)
    ]
    rbac_rows = [
        [Paragraph("User Provisioning & Team Management", tb_style), Paragraph("Full Access", tb_bold), Paragraph("View Only", tb_style), Paragraph("Forbidden (403)", tb_style)],
        [Paragraph("Lead Pipeline Visibility Scope", tb_style), Paragraph("All Organization Leads", tb_bold), Paragraph("All Team Leads", tb_bold), Paragraph("Assigned / Created Only", tb_style)],
        [Paragraph("Lead Creation & Interaction Notes", tb_style), Paragraph("Allowed", tb_style), Paragraph("Allowed", tb_style), Paragraph("Allowed", tb_style)],
        [Paragraph("Lead Assignment & Reassignment", tb_style), Paragraph("Allowed", tb_style), Paragraph("Allowed", tb_style), Paragraph("Forbidden (403)", tb_style)],
        [Paragraph("Customer Conversion Execution", tb_style), Paragraph("Allowed", tb_style), Paragraph("Allowed", tb_style), Paragraph("Forbidden (403)", tb_style)],
        [Paragraph("Hard Delete Lead Record", tb_style), Paragraph("Allowed", tb_style), Paragraph("Forbidden (403)", tb_style), Paragraph("Forbidden (403)", tb_style)],
        [Paragraph("View Organization Performance Analytics", tb_style), Paragraph("Full Metrics", tb_bold), Paragraph("Team Metrics", tb_bold), Paragraph("Own Metrics Only", tb_style)],
        [Paragraph("Export Financial & Lead Reports to CSV", tb_style), Paragraph("Allowed", tb_style), Paragraph("Allowed", tb_style), Paragraph("Forbidden (403)", tb_style)],
        [Paragraph("AI Call Intelligence & Recording Upload", tb_style), Paragraph("Allowed", tb_style), Paragraph("Allowed", tb_style), Paragraph("Allowed", tb_style)],
        [Paragraph("Conversational AI Copilot Drawer", tb_style), Paragraph("Org-Scoped Grounding", tb_style), Paragraph("Team-Scoped Grounding", tb_style), Paragraph("Self-Scoped Grounding", tb_style)],
        [Paragraph("Configure AI API Keys & System Settings", tb_style), Paragraph("Full Access", tb_bold), Paragraph("Forbidden (403)", tb_style), Paragraph("Forbidden (403)", tb_style)],
    ]

    rbac_table = Table([rbac_headers] + rbac_rows, colWidths=[180, 108, 108, 108])
    rbac_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(rbac_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>10.1. Authentication Architecture (JWT Rotation)</b>", h2_style))
    story.append(Paragraph(
        "Authentication is powered by <code>djangorestframework-simplejwt</code>. "
        "Clients authenticate with an email and password to receive a short-lived access token and a long-lived refresh token. "
        "The frontend Axios interceptor transparently negotiates token rotation upon receiving a 401 response, "
        "preventing mid-session user logouts while safeguarding against token theft.",
        body_style
    ))

    story.append(Spacer(1, 10))

    # ==================================================================
    # SECTION 11: REST APIS & FASTAPI MICROSERVICE
    # ==================================================================
    story.append(Paragraph("11. Feature 11: Architecture, APIs & Microservices", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "CRM Lite is engineered around a modern decoupled architecture. The React 19 Single Page Application communicates via "
        "REST APIs with the Django backend and optionally queries a dedicated FastAPI search microservice.",
        body_style
    ))

    # REST Endpoint Reference Table
    api_headers = [
        Paragraph("<b>HTTP Method & Route</b>", th_style),
        Paragraph("<b>Controller / View</b>", th_style),
        Paragraph("<b>Functionality & Scope</b>", th_style)
    ]
    api_rows = [
        [Paragraph("<code>POST /api/auth/token/</code>", code_style), Paragraph("CustomTokenObtainPairView", tb_style), Paragraph("Authenticate credentials; issue JWT pair", tb_style)],
        [Paragraph("<code>POST /api/auth/token/refresh/</code>", code_style), Paragraph("TokenRefreshView", tb_style), Paragraph("Renew expired access token using refresh token", tb_style)],
        [Paragraph("<code>GET/POST /api/leads/</code>", code_style), Paragraph("LeadViewSet", tb_style), Paragraph("List leads (role-filtered) and create new prospects", tb_style)],
        [Paragraph("<code>GET/PATCH /api/leads/:id/</code>", code_style), Paragraph("LeadViewSet", tb_style), Paragraph("Retrieve lead details or update attributes/stage", tb_style)],
        [Paragraph("<code>POST /api/leads/:id/convert/</code>", code_style), Paragraph("LeadViewSet.convert", tb_style), Paragraph("Execute atomic conversion to official Customer", tb_style)],
        [Paragraph("<code>POST /api/leads/:id/ai_summary/</code>", code_style), Paragraph("LeadViewSet.ai_summary", tb_style), Paragraph("Synthesize comprehensive AI lead dossier", tb_style)],
        [Paragraph("<code>GET/POST /api/follow-ups/</code>", code_style), Paragraph("FollowUpViewSet", tb_style), Paragraph("List and schedule follow-ups with anti-past validation", tb_style)],
        [Paragraph("<code>POST /api/follow-ups/:id/complete/</code>", code_style), Paragraph("FollowUpViewSet.complete", tb_style), Paragraph("Log outcome notes and mark task finished", tb_style)],
        [Paragraph("<code>POST /api/ai/call-summary/</code>", code_style), Paragraph("AICallSummaryView", tb_style), Paragraph("Multimodal audio upload and deal analysis", tb_style)],
        [Paragraph("<code>POST /api/ai/chat/</code>", code_style), Paragraph("AIChatView", tb_style), Paragraph("Conversational Copilot query with CRM grounding", tb_style)],
        [Paragraph("<code>POST /api/ai/execute-action/</code>", code_style), Paragraph("AIActionExecuteView", tb_style), Paragraph("Execute human-confirmed Copilot write action", tb_style)],
        [Paragraph("<code>GET /api/reports/dashboard/</code>", code_style), Paragraph("ReportDashboardView", tb_style), Paragraph("Zero-hardcoded real-time KPI aggregations", tb_style)],
        [Paragraph("<code>GET /api/reports/export-csv/</code>", code_style), Paragraph("ReportExportCSVView", tb_style), Paragraph("Streaming HTTP response generating lead CSV export", tb_style)],
        [Paragraph("<code>GET /api/fastapi/search/</code>", code_style), Paragraph("FastAPI Service (:8001)", tb_style), Paragraph("Ultra-low-latency federated prospect & note search", tb_style)],
    ]
    api_table = Table([api_headers] + api_rows, colWidths=[140, 130, 234])
    api_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BRAND_DARK),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(api_table)

    story.append(PageBreak())

    # ==================================================================
    # SECTION 12: UI/UX DESIGN SYSTEM & APPENDIX
    # ==================================================================
    story.append(Paragraph("12. Feature 12: Modern UI/UX Design System", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph(
        "CRM Lite strictly avoids bulky, generic CSS utility frameworks. The frontend features a bespoke, hand-crafted Vanilla CSS "
        "design system engineered for instantaneous load times and rich visual aesthetics.",
        body_style
    ))

    design_elements = [
        ("Dark Glassmorphism", "Deep charcoal slate backgrounds (<code>#0B0F19</code>) paired with frosted glass cards using backdrop blur filters (<code>backdrop-filter: blur(12px)</code>) and subtle translucent border glows."),
        ("Modern Typography", "Pairing Google Fonts <code>Outfit</code> (for bold, modern headings and metric displays) with <code>Plus Jakarta Sans</code> (for ultra-crisp body copy and tabular data)."),
        ("Responsive Layouts", "Fluid CSS Grid and Flexbox layouts designed for high-density desktop displays, standard laptops, and mobile tablet viewports."),
        ("Micro-Interactions", "Subtle transition effects on button hovers, smooth modal slide-ins, and pulsating status badges for urgent/overdue states."),
        ("Zero Dependency Bloat", "Zero Tailwind runtime bloat or fragile post-CSS build dependencies; lightning-fast Vite compilation.")
    ]
    design_table = Table([[Paragraph(f"<b>{k}</b>", tb_bold), Paragraph(v, tb_style)] for k, v in design_elements], colWidths=[130, 374])
    design_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(design_table)
    story.append(Spacer(1, 10))

    # ==================================================================
    # SECTION 13: TEST SUITE & QUICK REFERENCE
    # ==================================================================
    story.append(Paragraph("13. Quality Assurance & Developer Cheatsheet", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph("<b>Automated Test Suite Verification</b>", h3_style))
    story.append(Paragraph(
        "CRM Lite features automated test coverage across authentication, role permissions, past follow-up rejection, "
        "and atomic customer conversion transactions. Execute the suite via:",
        body_style
    ))
    story.append(Paragraph("<code>python backend/manage.py test accounts leads followups notifications</code>", code_style))
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>Quick Local Start Commands</b>", h3_style))
    commands_data = [
        [Paragraph("<b>Step</b>", th_style), Paragraph("<b>Command Line Instruction</b>", th_style), Paragraph("<b>Description</b>", th_style)],
        [
            Paragraph("1. Backend", tb_bold),
            Paragraph("<code>python backend/manage.py runserver 8000</code>", code_style),
            Paragraph("Launches Django REST API at <code>http://127.0.0.1:8000/api/</code>", tb_style)
        ],
        [
            Paragraph("2. Frontend", tb_bold),
            Paragraph("<code>cd frontend &amp;&amp; npm run dev</code>", code_style),
            Paragraph("Launches React 19 Vite SPA at <code>http://localhost:5173/</code>", tb_style)
        ],
        [
            Paragraph("3. Microservice", tb_bold),
            Paragraph("<code>uvicorn fastapi_service.main:app --port 8001</code>", code_style),
            Paragraph("Launches optional FastAPI search microservice", tb_style)
        ],
        [
            Paragraph("4. Seed Data", tb_bold),
            Paragraph("<code>python backend/manage.py seed_data</code>", code_style),
            Paragraph("Populates realistic leads, calls, notes, and metrics", tb_style)
        ],
        [
            Paragraph("5. Interactive Docs", tb_bold),
            Paragraph("Visit <code>http://127.0.0.1:8000/api/docs/</code>", code_style),
            Paragraph("OpenAPI 3.0 / Swagger UI interactive API console", tb_style)
        ]
    ]
    cmd_table = Table(commands_data, colWidths=[90, 230, 184])
    cmd_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(cmd_table)
    story.append(Spacer(1, 14))

    # Concluding Sign-Off Callout
    story.append(create_callout_box(
        "SPECIFICATION APPROVAL & RELEASE ATTESTATION",
        "This product and feature specification represents the verified state of the CRM Lite platform. "
        "All features detailed herein—including the 7-stage visual pipeline, atomic customer conversion, "
        "multimodal audio transcription, CRM copilot drawer, and real-time KPI dashboards—are fully functional, "
        "tested, and ready for production deployment.",
        callout_type="success",
        width=PAGE_WIDTH
    ))

    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Features documentation successfully generated at: {output_path}")


if __name__ == "__main__":
    import shutil
    current_dir = os.path.dirname(os.path.abspath(__file__))
    output_pdf = os.path.join(current_dir, "CRM_Lite_All_Features_Guide.pdf")
    build_crm_features_pdf(output_pdf)

    # Replicate documentation PDF to all standard locations
    targets = [
        os.path.join(current_dir, "CRM_Lite_Documentation.pdf"),
        os.path.join(current_dir, "docs", "CRM_Lite_All_Features_Guide.pdf"),
        os.path.join(current_dir, "docs", "CRM_Lite_Documentation.pdf"),
    ]
    for target in targets:
        os.makedirs(os.path.dirname(target), exist_ok=True)
        shutil.copyfile(output_pdf, target)
        print(f"Synchronized PDF copy to: {target}")
