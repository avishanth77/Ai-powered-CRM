import os
import sys
import shutil
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

class BulletNumberedCanvas(canvas.Canvas):
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
            self.draw_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_decorations(self, total_pages):
        self.saveState()
        # Header
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#0F172A"))
        self.drawString(40, 11 * 72 - 28, "CRM LITE")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#0D9488"))
        self.drawString(90, 11 * 72 - 28, "|   Core Features & Capabilities Summary")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawRightString(8.5 * 72 - 40, 11 * 72 - 28, "Production Overview")

        # Top line
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.75)
        self.line(40, 11 * 72 - 34, 8.5 * 72 - 40, 11 * 72 - 34)

        # Bottom line
        self.line(40, 36, 8.5 * 72 - 40, 36)

        # Footer
        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(40, 24, "CRM Lite — AI-Powered Customer Relationship & Pipeline Management Platform")
        page_str = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(8.5 * 72 - 40, 24, page_str)
        self.restoreState()


def create_feature_summary_pdf(output_path):
    PAGE_WIDTH = 8.5 * 72 - 80  # 532 pt

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=42,
        bottomMargin=42,
    )

    styles = getSampleStyleSheet()

    PRIMARY = colors.HexColor("#0F172A")       # Slate 900
    BRAND = colors.HexColor("#0D9488")         # Teal 600
    BRAND_DARK = colors.HexColor("#115E59")    # Teal 800
    TEXT_DARK = colors.HexColor("#1E293B")     # Slate 800
    TEXT_MUTED = colors.HexColor("#64748B")    # Slate 500
    BG_LIGHT = colors.HexColor("#F8FAFC")      # Slate 50
    BORDER_COLOR = colors.HexColor("#CBD5E1")  # Slate 300
    BULLET_COLOR = colors.HexColor("#0D9488")  # Brand bullet

    title_style = ParagraphStyle(
        'MainTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=PRIMARY,
        spaceAfter=2,
    )

    subtitle_style = ParagraphStyle(
        'MainSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=BRAND,
        spaceAfter=8,
    )

    cat_style = ParagraphStyle(
        'CategoryTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=PRIMARY,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True,
    )

    bullet_style = ParagraphStyle(
        'FeatureBullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=TEXT_DARK,
        leftIndent=14,
        firstLineIndent=-14,
        spaceAfter=3.5,
    )

    badge_style = ParagraphStyle(
        'BadgeText',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white,
    )

    story = []

    # Title Header Block
    story.append(Paragraph("CRM Lite — Main Features & Capabilities", title_style))
    story.append(Paragraph("A concise, bullet-pointed summary of all primary features, AI services, and workflows.", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=BRAND, spaceBefore=0, spaceAfter=8))

    # Feature Categories Data: (Category Name, Icon/Number, [ (Feature Title, Short Description) ])
    features_data = [
        (
            "1. Lead Management & 360° Tracking",
            [
                ("Full Lead Lifecycle Tracking", "Captures prospect contact details, organization, job title, industry, deal value, win probability percentage, and assigned representative."),
                ("Multi-Channel Sourcing", "Tracks origin channels (Website, LinkedIn, Referrals, Cold Outreach, Trade Shows, Webinars) to identify high-converting lead channels."),
                ("Priority & Qualification Scoring", "Assigns automated priority tiers (Low, Medium, High, Urgent) and a 0–100 score to guide sales rep focus toward the highest-value opportunities."),
                ("Duplicate Lead Warning", "Monitors incoming prospects against existing email addresses and phone numbers to prevent duplicate records and territory conflicts."),
                ("Multi-Type Interaction Notes", "Logs client communications categorized as Call, WhatsApp, Email, Meeting, Demo, Objection, or General notes."),
                ("Chronological Activity Timeline", "Maintains an immutable, time-stamped audit trail of every status change, note added, assignment, and scheduled follow-up."),
                ("Atomic Customer Conversion", "Converts qualified won leads into official Customer accounts inside a database transaction (<code>transaction.atomic()</code>), retaining all original notes and call logs."),
                ("Mandatory Loss Reason Attribution", "Prompts for a structured root cause (Budget, Competitor, Feature Gap, Timing, No Response) when a deal is lost to inform win/loss analysis."),
                ("Search, Multi-Filter & CSV Export", "Offers instant keyword search, stage/rep/priority filtering, and streaming CSV downloads of filtered lead records.")
            ]
        ),
        (
            "2. Visual Sales Pipeline (Kanban Board)",
            [
                ("7-Stage Sales Lifecycle Funnel", "Visualizes deals across seven standardized stages: <b>New</b>, <b>Contacted</b>, <b>Demo Scheduled</b>, <b>Negotiation</b>, <b>Qualified</b>, <b>Won</b>, and <b>Lost</b>."),
                ("Interactive Kanban Board", "Renders responsive deal cards with drag-and-drop movement or one-click stage progression buttons."),
                ("Real-Time Column Value & Deal Totals", "Dynamically sums the total deal count and aggregated monetary value for each stage column without page reloads."),
                ("Multi-Parameter Pipeline Filtering", "Instantly filters the entire pipeline by assigned sales representative, priority level, date range, or prospect search."),
                ("Automated Stage Change Triggers", "Automatically dispatches in-app notifications and branded email alerts when a lead progresses to another stage.")
            ]
        ),
        (
            "3. Smart Follow-Up Engine & Task Scheduler",
            [
                ("Precision Follow-Up Scheduler", "Allows scheduling follow-up calls, emails, or meetings with exact dates, times, priority levels, and reminder notes."),
                ("Anti-Past Date Validation", "Enforces strict backend and frontend validation preventing tasks from ever being scheduled in the past."),
                ("Automated Overdue Detection", "Automatically detects and flags overdue tasks with prominent warning badges and increments executive dashboard alert counts."),
                ("'Due Today' Action Hub", "Provides sales representatives with a focused morning queue of tasks requiring attention on the current day."),
                ("Mandatory Outcome Logging", "Requires reps to document interaction outcomes (notes and results) before marking a follow-up task as complete.")
            ]
        ),
        (
            "4. Interactive Sales Calendar Hub",
            [
                ("Month, Week & Day Calendar Views", "Provides comprehensive scheduling layouts to visualize appointments, follow-ups, and customer demos."),
                ("Color-Coded Event Cards", "Visually distinguishes calls (Teal), meetings (Blue), demos (Purple), and urgent tasks (Red)."),
                ("Direct In-Calendar Booking", "Clicking any open calendar slot opens a scheduling modal with pre-filled date and time."),
                ("1-Click Record Navigation", "Clicking any calendar event navigates directly to the associated lead or customer profile.")
            ]
        ),
        (
            "5. Converted Customer Management",
            [
                ("Dedicated Customer Directory", "Maintains an active directory of paying customer accounts separate from active sales pipeline leads."),
                ("360° Customer Profile & Origin Lineage", "Links customer profiles directly back to the original lead record, preserving original source, conversion date, and rep."),
                ("Lifetime Value (LTV) Tracking", "Tracks closed deal amounts, active contract values, and renewal milestones for customer success teams."),
                ("Full Interaction Archive Preservation", "Seamlessly preserves and displays all pre-conversion phone recordings, notes, and emails within the customer profile.")
            ]
        ),
        (
            "6. Artificial Intelligence (AI) Suite (Powered by Gemini 2.5 Flash)",
            [
                ("Multimodal Speech-to-Text Call Transcription", "Transcribes sales call audio directly from browser recordings or uploaded files (.mp3, .wav, .m4a, .webm, .ogg up to 25MB) using native multimodal Gemini audio understanding."),
                ("Automated Call Deal Intelligence", "Automatically extracts executive summaries, customer intent, key objections, sentiment, stage recommendations, and action items in structured JSON."),
                ("1-Click Call Sync to CRM", "Appends call summaries and action items directly to the lead timeline and updates deal stage with a single click."),
                ("Conversational CRM AI Copilot", "Slide-out assistant drawer grounded in live CRM database records (leads, pipeline values, overdue tasks) for natural language querying."),
                ("Safe Action Confirmation Protocol", "Allows the Copilot to draft actions (create lead, schedule follow-up, update stage) with interactive UI cards requiring human confirmation before database execution."),
                ("Lead Dossier AI Synthesis", "Generates on-demand executive briefings summarizing a prospect's entire communication history with prescriptive stage-progression recommendations."),
                ("Dynamic Environment Key Reloading", "Automatically detects updated Gemini API keys in <code>backend/.env</code> on the fly without requiring server restarts."),
                ("Central AI Operations Center & Settings", "Dedicated page to monitor AI provider connectivity, inspect token usage, and adjust model temperature sliders.")
            ]
        ),
        (
            "7. Team Collaboration & Internal Mentions",
            [
                ("Private Internal Team Notes", "Enables sales reps and managers to post internal deal notes and handoff comments that remain completely hidden from external clients."),
                ("Team Member @Mentions Autocomplete", "Typing '@' in any internal comment brings up an interactive dropdown of active sales colleagues for instant tagging."),
                ("Instant Mention Notifications", "Automatically dispatches an in-app alert to the tagged team member linking directly to the specific conversation thread.")
            ]
        ),
        (
            "8. Notification & Real-Time Alert Engine",
            [
                ("In-App Notification Bell & Live Badge", "Header notification bell with an unread badge counter, priority indicators (Low, Normal, High, Urgent), and one-click navigation to the target record."),
                ("Automated Transactional HTML Emails", "Dispatches responsive HTML emails with stage comparison pills and direct action links (e.g. <code>lead_stage_updated.html</code>)."),
                ("Anti-Self-Notification Filtering", "Intelligently suppresses notification alerts when a user performs the action themselves, eliminating alert fatigue."),
                ("SMTP Diagnostic CLI Tool", "Includes a pre-built verification utility (<code>python backend/check_email.py</code>) to test live email delivery and Google App Password connectivity.")
            ]
        ),
        (
            "9. Real-Time KPI Dashboards & Analytics",
            [
                ("Zero-Hardcoded Executive Dashboard", "Dynamically aggregates live metrics: Total Active Leads, Converted Customers, Overall Win Rate %, Total Pipeline Value, and Overdue Tasks."),
                ("Visual Pipeline Funnel & Stage Distribution", "Displays real-time deal distribution charts and monthly lead acquisition trends."),
                ("Sales Representative Scorecards", "Compares individual rep metrics: leads handled, deals won vs lost, conversion ratios, and closed contract revenue."),
                ("Streaming High-Performance CSV Export", "Streams filtered lead and financial data directly to the client browser without server memory overhead.")
            ]
        ),
        (
            "10. Role-Based Access Control (RBAC) & Security",
            [
                ("3-Tier User Role Hierarchy", "Admin / Mentor (full organization control & deletion), Sales Manager (team pipeline & conversions), and Sales Executive (assigned leads only)."),
                ("Strict Data Privacy Isolation", "Sales executives can only view and modify leads assigned to them or created by them, preventing unauthorized data access."),
                ("JWT Authentication with Silent Refresh", "Secured with JSON Web Tokens (Access + Refresh); frontend Axios interceptors automatically renew expired tokens without interrupting the user."),
                ("FastAPI Federated Search Microservice", "Includes an optional FastAPI microservice (:8001) for sub-50ms fuzzy search across leads, contacts, and notes.")
            ]
        )
    ]

    for cat_title, bullets in features_data:
        # Wrap each category in a KeepTogether or clear block
        cat_elements = []
        
        # Category Bar Banner
        bar_table = Table([[
            Paragraph(f"<b>{cat_title.upper()}</b>", ParagraphStyle('CatBanner', fontName='Helvetica-Bold', fontSize=9, textColor=colors.HexColor("#0F172A")))
        ]], colWidths=[PAGE_WIDTH])
        bar_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
            ('BOX', (0,0), (-1,-1), 0.75, BORDER_COLOR),
            ('LINELEFT', (0,0), (0,-1), 3, BRAND),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ]))
        cat_elements.append(bar_table)
        cat_elements.append(Spacer(1, 4))

        for feat_name, feat_desc in bullets:
            bullet_html = f"<font color='#0D9488'><b>&#9679;</b></font> <b>{feat_name}:</b> {feat_desc}"
            cat_elements.append(Paragraph(bullet_html, bullet_style))

        cat_elements.append(Spacer(1, 5))
        story.append(KeepTogether(cat_elements))

    # Concluding Box
    summary_box = Table([[
        Paragraph(
            "<b>Summary:</b> CRM Lite combines rigorous operational pipeline control with state-of-the-art multimodal AI call transcription, "
            "an in-app Copilot assistant, atomic conversions, automated follow-up governance, and live KPI dashboards. "
            "All features above are fully implemented and running in the production environment.",
            ParagraphStyle('SummaryText', fontName='Helvetica', fontSize=8, leading=11.5, textColor=PRIMARY)
        )
    ]], colWidths=[PAGE_WIDTH])
    summary_box.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F0FDFA")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#99F6E4")),
        ('LINELEFT', (0,0), (0,-1), 3.5, BRAND),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(Spacer(1, 4))
    story.append(summary_box)

    doc.build(story, canvasmaker=BulletNumberedCanvas)
    print(f"Features summary successfully generated at: {output_path}")

    # Synchronize across standard documentation paths
    current_dir = os.path.dirname(os.path.abspath(output_path))
    targets = [
        os.path.join(current_dir, "CRM_Features_Summary.pdf"),
        os.path.join(current_dir, "CRM_Lite_Features.pdf"),
        os.path.join(current_dir, "CRM_Lite_Documentation.pdf"),
        os.path.join(current_dir, "docs", "CRM_Features_Summary.pdf"),
        os.path.join(current_dir, "docs", "CRM_Lite_Features.pdf"),
        os.path.join(current_dir, "docs", "CRM_Lite_Documentation.pdf"),
    ]
    for target in targets:
        if os.path.abspath(target) != os.path.abspath(output_path):
            os.makedirs(os.path.dirname(target), exist_ok=True)
            shutil.copyfile(output_path, target)
            print(f"Synchronized PDF copy to: {target}")


if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    output_pdf = os.path.join(current_dir, "CRM_Features_Summary.pdf")
    create_feature_summary_pdf(output_pdf)
