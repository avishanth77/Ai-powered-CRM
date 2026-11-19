"""
SaaS Product Explainer Video Recorder with Commercial Voiceover Narration
========================================================================
Generates a broadcast-quality, high-converting SaaS Product Explainer Video
for CRM Lite. Features:
- Compelling, benefit-driven commercial narration (Problem -> Solution -> Value -> CTA)
- Highlights the Customizable Automated Task Assigning & Routing Engine
- Showcases the Lead Management Hub with Real-Time Monetary Value Metrics
- Studio-grade Microsoft Neural Voiceover (en-US-ChristopherNeural)
- Ultra-premium glassmorphism SaaS HUD banner with animated gradient badges
- Glowing emerald animated cursor with click ripple feedback
- Precision audio-video synchronization merged via FFmpeg into MP4 and WebM

Usage:
  python scripts/record_crm_saas_explainer_video.py            # Headless run in background
  python scripts/record_crm_saas_explainer_video.py --headed   # Watch Chrome record live
  python scripts/record_crm_saas_explainer_video.py --voice "en-US-ChristopherNeural"
"""

import os
import sys
import time
import re
import asyncio
import subprocess
import argparse
from pathlib import Path

# Setup Django environment for valid JWT authentication
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
import json
import edge_tts
import imageio_ffmpeg
from playwright.sync_api import sync_playwright

User = get_user_model()
FFMPEG_BIN = imageio_ffmpeg.get_ffmpeg_exe()


# High-Converting SaaS Explainer Script (Problem -> Solution -> Value -> CTA)
# Enhanced to feature Customizable Auto-Task Assignment as a primary pillar
SAAS_EXPLAINER_SCRIPT = {
    "scene1_intro": (
        "CRM LITE • EXECUTIVE PLATFORM",
        "Close Deals Faster with Intelligent Sales Execution",
        "Tired of clunky spreadsheets, lost follow-ups, and deals slipping through the cracks? "
        "Meet CRM Lite — the intelligent sales execution platform designed for modern, high-velocity teams. "
        "From the moment you log in, your Executive Dashboard delivers 360-degree visibility over active pipeline values, "
        "win rates, and revenue forecasts, empowering your leadership to make confident, data-driven decisions."
    ),
    "scene2_leads": (
        "LEAD MANAGEMENT HUB",
        "Prospect Intelligence with Real-Time Monetary Value Metrics",
        "Track every prospect with precision. Our Lead Management dashboard gives you live metric intelligence, "
        "displaying not just lead counts, but real-time monetary values for New Prospects, Qualified Leads, and High Priority opportunities. "
        "Filter instantly by stage, source, or priority, and ensure your sales reps always focus where the revenue potential is highest."
    ),
    "scene3_deal_desk": (
        "DYNAMIC DEAL DESK",
        "Instant Lead Creation & Flexible Product Pricing Negotiation",
        "Speed is everything in enterprise sales. Creating a new prospect takes just seconds. "
        "Select products from your catalog, and our dynamic deal desk instantly calculates pricing breakdowns. "
        "Need to negotiate? Adjust the custom unit price on the fly. The effective deal total and live deal preview update in real time, "
        "giving your reps the power to structure winning quotes with complete confidence."
    ),
    "scene4_auto_tasks": (
        "AUTOMATED WORKFLOW ENGINE",
        "Customizable Auto-Task Assignment & Stage Progression Rules",
        "Here is where CRM Lite sets your sales engine on autopilot: our customizable automated task assignment engine. "
        "Sales managers can configure automated stage task rules that trigger the exact moment a lead enters any pipeline stage. "
        "Choose from flexible assignment strategies: route tasks directly to the Lead Owner, rotate fairly across a Round-Robin pool of sales reps, "
        "or assign to designated specialists. Set dynamic due date offsets in hours or days, and enforce mandatory progression gates so critical qualification steps are never skipped."
    ),
    "scene5_workspace": (
        "360° CUSTOMER WORKSPACE",
        "HubSpot-Style Profile with Actionable Stage Task Checklists",
        "Eliminate tab clutter with our HubSpot-inspired three-column lead workspace. In a single unified view, "
        "reps access complete contact demographics, product interests, and the Stage Tasks tab. "
        "Here, automatically assigned tasks appear with clear priorities and due dates. Reps can check off deliverables or reassign tasks, "
        "while built-in progression gating ensures deals only advance when qualification requirements are 100% satisfied."
    ),
    "scene6_pipeline": (
        "PIPELINE ACCELERATION",
        "Visual Kanban Pipeline with Mandatory Qualification Gates",
        "Managing your sales velocity has never been smoother. With our visual Kanban board, track deal progression seamlessly across custom stages. "
        "Every stage change enforces your task automation rules, keeping your CRM clean, your sales reps accountable, and your pipeline moving at maximum velocity."
    ),
    "scene7_collaboration": (
        "DEAL COLLABORATION",
        "Real-Time 1-on-1 Team Chat Without Context Switching",
        "Never lose deal momentum to external chat apps. CRM Lite features integrated one-on-one direct messaging. "
        "With instant delivery and unread notification badges, sales managers and executives can immediately strategize on quotes, "
        "share updates, and unblock high-value deals together in real time."
    ),
    "scene8_cta": (
        "TRANSFORM YOUR SALES",
        "CRM Lite: The Modern Sales Execution Engine",
        "Accelerate your sales pipeline, boost rep productivity, and automate task assignment with CRM Lite. "
        "Ready to transform your sales organization? Get started today and experience modern CRM power."
    ),
}


def get_auth_payload():
    """Generates valid JWT tokens for the primary admin user."""
    admin = User.objects.filter(is_superuser=True).first()
    if not admin:
        admin = User.objects.filter(role='ADMIN').first()
    if not admin:
        admin = User.objects.first()

    if not admin:
        raise RuntimeError("No user found in database to record demo.")

    refresh = RefreshToken.for_user(admin)
    access_token = str(refresh.access_token)
    refresh_token = str(refresh)

    user_data = {
        "id": admin.id,
        "email": admin.email,
        "first_name": admin.first_name or "Admin",
        "last_name": admin.last_name or "User",
        "role": getattr(admin, 'role', 'ADMIN'),
        "is_superuser": admin.is_superuser,
    }
    return access_token, refresh_token, user_data


def get_audio_duration(file_path):
    """Calculates the duration in seconds of an audio file using FFmpeg."""
    cmd = [FFMPEG_BIN, "-i", str(file_path)]
    res = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True)
    match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", res.stderr)
    if match:
        h, m, s = match.groups()
        return int(h) * 3600 + int(m) * 60 + float(s)
    return 10.0


async def generate_saas_voiceover(audio_dir, voice="en-US-ChristopherNeural"):
    """Pre-generates high-energy, commercial SaaS voiceover audio."""
    audio_path = Path(audio_dir)
    audio_path.mkdir(parents=True, exist_ok=True)

    durations = {}
    print(f"🎙️ Generating Commercial SaaS Voiceover Audio (Voice: {voice})...")

    for key, (badge, title, script_text) in SAAS_EXPLAINER_SCRIPT.items():
        file_name = audio_path / f"{key}.mp3"
        comm = edge_tts.Communicate(script_text, voice, rate="+3%")
        await comm.save(str(file_name))
        dur = get_audio_duration(file_name)
        durations[key] = dur
        print(f"   ✓ {key}: {dur:.1f}s — \"{title}\"")

    return durations


def create_full_audio_track(audio_dir, durations, output_file):
    """Concatenates all SaaS explainer audio clips into a unified soundtrack."""
    audio_path = Path(audio_dir)
    concat_list_file = audio_path / "concat_list.txt"

    with open(concat_list_file, "w", encoding="utf-8") as f:
        for key in SAAS_EXPLAINER_SCRIPT.keys():
            clip_path = (audio_path / f"{key}.mp3").resolve()
            safe_path = str(clip_path).replace("\\", "/")
            f.write(f"file '{safe_path}'\n")

    cmd = [
        FFMPEG_BIN,
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(concat_list_file),
        "-c", "copy",
        str(output_file)
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True)
    print(f"🎵 Master SaaS Voiceover Soundtrack created: {output_file}")


# JavaScript to inject a high-end SaaS glassmorphism HUD overlay and cursor
SAAS_HUD_JS = """
(() => {
  window.setTutorialStep = (badgeText, titleText, descText) => {
    window.ensureTutorialHud();
    const b = document.getElementById('saas-badge');
    const t = document.getElementById('saas-title');
    const d = document.getElementById('saas-desc');
    const card = document.getElementById('saas-hud-card');
    if (!card) return;

    card.style.opacity = '0';
    card.style.transform = 'translateX(-50%) translateY(12px) scale(0.98)';

    setTimeout(() => {
      if (b) b.textContent = badgeText;
      if (t) t.textContent = titleText;
      if (d) d.textContent = descText;
      card.style.opacity = '1';
      card.style.transform = 'translateX(-50%) translateY(0) scale(1)';
    }, 220);
  };

  window.ensureTutorialHud = () => {
    if (!document.body) return;

    // 1. Glowing animated cursor with click ripple
    if (!document.getElementById('saas-demo-cursor')) {
      const cursor = document.createElement('div');
      cursor.id = 'saas-demo-cursor';
      cursor.style.position = 'fixed';
      cursor.style.top = '0';
      cursor.style.left = '0';
      cursor.style.width = '24px';
      cursor.style.height = '24px';
      cursor.style.borderRadius = '50%';
      cursor.style.border = '2.5px solid #10b981';
      cursor.style.backgroundColor = 'rgba(16, 185, 129, 0.25)';
      cursor.style.boxShadow = '0 0 18px rgba(16, 185, 129, 0.75)';
      cursor.style.pointerEvents = 'none';
      cursor.style.zIndex = '9999999';
      cursor.style.transform = 'translate(-50%, -50%)';
      cursor.style.transition = 'width 0.15s, height 0.15s, background-color 0.15s';
      document.body.appendChild(cursor);

      window.addEventListener('mousemove', (e) => {
        cursor.style.top = e.clientY + 'px';
        cursor.style.left = e.clientX + 'px';
      });

      window.addEventListener('mousedown', () => {
        cursor.style.width = '14px';
        cursor.style.height = '14px';
        cursor.style.backgroundColor = 'rgba(16, 185, 129, 0.85)';
      });

      window.addEventListener('mouseup', () => {
        cursor.style.width = '24px';
        cursor.style.height = '24px';
        cursor.style.backgroundColor = 'rgba(16, 185, 129, 0.25)';
      });
    }

    // 2. High-End SaaS Explainer HUD Card (Bottom-Center)
    if (!document.getElementById('saas-hud-card')) {
      const hud = document.createElement('div');
      hud.id = 'saas-hud-card';
      hud.style.position = 'fixed';
      hud.style.bottom = '24px';
      hud.style.left = '50%';
      hud.style.transform = 'translateX(-50%)';
      hud.style.width = '90%';
      hud.style.maxWidth = '900px';
      hud.style.background = 'rgba(15, 23, 42, 0.92)';
      hud.style.backdropFilter = 'blur(20px)';
      hud.style.webkitBackdropFilter = 'blur(20px)';
      hud.style.border = '1px solid rgba(255, 255, 255, 0.15)';
      hud.style.borderRadius = '16px';
      hud.style.padding = '14px 22px';
      hud.style.boxShadow = '0 25px 50px rgba(0, 0, 0, 0.75), 0 0 35px rgba(16, 185, 129, 0.18)';
      hud.style.display = 'flex';
      hud.style.flexDirection = 'column';
      hud.style.gap = '6px';
      hud.style.zIndex = '9999998';
      hud.style.pointerEvents = 'none';
      hud.style.transition = 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)';

      const topRow = document.createElement('div');
      topRow.style.display = 'flex';
      topRow.style.alignItems = 'center';
      topRow.style.gap = '10px';

      const badge = document.createElement('span');
      badge.id = 'saas-badge';
      badge.textContent = 'CRM LITE';
      badge.style.background = 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)';
      badge.style.color = '#ffffff';
      badge.style.fontSize = '10px';
      badge.style.fontWeight = '800';
      badge.style.letterSpacing = '0.08em';
      badge.style.padding = '3px 9px';
      badge.style.borderRadius = '20px';
      badge.style.textTransform = 'uppercase';

      const title = document.createElement('span');
      title.id = 'saas-title';
      title.textContent = 'Intelligent Sales Execution Platform';
      title.style.color = '#f8fafc';
      title.style.fontSize = '15px';
      title.style.fontWeight = '700';
      title.style.fontFamily = 'Outfit, system-ui, sans-serif';

      topRow.appendChild(badge);
      topRow.appendChild(title);

      const desc = document.createElement('div');
      desc.id = 'saas-desc';
      desc.textContent = 'Close more deals with unified sales intelligence.';
      desc.style.color = '#cbd5e1';
      desc.style.fontSize = '12.5px';
      desc.style.lineHeight = '1.45';
      desc.style.fontFamily = 'Inter, system-ui, sans-serif';

      hud.appendChild(topRow);
      hud.appendChild(desc);
      document.body.appendChild(hud);
    }
  };

  document.addEventListener('DOMContentLoaded', window.ensureTutorialHud);
})();
"""


def smooth_scroll(page, distance=300, steps=12, delay=0.03):
    """Performs smooth cinematic page scrolling."""
    step_dist = distance / steps
    for _ in range(steps):
        page.evaluate(f"window.scrollBy({{ top: {step_dist}, behavior: 'smooth' }});")
        time.sleep(delay)


def type_naturally(locator, text, delay=0.04):
    """Types text character by character naturally."""
    for char in text:
        locator.type(char, delay=int(delay * 1000))


def update_hud(page, badge, title, desc):
    """Safely updates the on-screen SaaS HUD banner."""
    try:
        clean_desc = desc[:150] + ("..." if len(desc) > 150 else "")
        page.evaluate(f"""
            if (window.setTutorialStep) {{
                window.setTutorialStep({json.dumps(badge)}, {json.dumps(title)}, {json.dumps(clean_desc)});
            }}
        """)
    except Exception:
        pass


def record_saas_explainer_video(output_dir="demo_videos", frontend_url="http://localhost:5173", headed=False, voice="en-US-ChristopherNeural"):
    """Records the full SaaS Explainer Video with live audio-video synchronization."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    audio_path = output_path / "saas_audio_clips"

    # 1. Pre-generate all SaaS voiceover clips
    durations = asyncio.run(generate_saas_voiceover(audio_path, voice=voice))

    # 2. Concatenate audio into a single master audio track
    master_audio_file = output_path / "saas_explainer_narration.mp3"
    create_full_audio_track(audio_path, durations, master_audio_file)

    access_token, refresh_token, user_data = get_auth_payload()
    print(f"🔑 Authenticated as: {user_data['email']} ({user_data['role']})")

    raw_video_dir = output_path / "raw_video_saas"
    raw_video_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        print("🎬 Launching Chrome for 1080p SaaS Explainer Video Recording...")
        browser = p.chromium.launch(
            channel="chrome",
            headless=not headed,
            slow_mo=180,
        )

        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir=str(raw_video_dir),
            record_video_size={"width": 1920, "height": 1080},
        )

        context.add_init_script(f"""
            localStorage.setItem('crm_access_token', '{access_token}');
            localStorage.setItem('crm_refresh_token', '{refresh_token}');
            localStorage.setItem('crm_user', '{json.dumps(user_data)}');
        """)

        page = context.new_page()
        page.add_init_script(SAAS_HUD_JS)

        # -------------------------------------------------------------
        # SCENE 1: The Hook & Executive Dashboard
        # -------------------------------------------------------------
        t0 = time.time()
        print("🚀 [Scene 1/8] Recording SaaS Hook & Executive Dashboard...")
        page.goto(f"{frontend_url}/dashboard", wait_until="networkidle")
        b, t, d = SAAS_EXPLAINER_SCRIPT["scene1_intro"]
        update_hud(page, b, t, d)
        time.sleep(2.0)
        smooth_scroll(page, distance=380, steps=15)
        time.sleep(2.0)
        smooth_scroll(page, distance=-380, steps=15)

        elapsed = time.time() - t0
        target_dur = durations["scene1_intro"]
        if elapsed < target_dur:
            time.sleep(target_dur - elapsed)

        # -------------------------------------------------------------
        # SCENE 2: Lead Management Hub & Real-Time Monetary Value Metrics
        # -------------------------------------------------------------
        t0 = time.time()
        print("📊 [Scene 2/8] Recording Lead Management Hub with Total Value Metrics...")
        page.goto(f"{frontend_url}/leads", wait_until="networkidle")
        b, t, d = SAAS_EXPLAINER_SCRIPT["scene2_leads"]
        update_hud(page, b, t, d)
        time.sleep(1.5)

        # Hover over top summary cards showcasing Total Value
        for card_selector in [
            '.lead-summary-card.summary-card-accent-cyan',
            '.lead-summary-card.summary-card-accent-blue',
            '.lead-summary-card.summary-card-accent-amber',
            '.lead-summary-card.summary-card-accent-emerald'
        ]:
            c = page.locator(card_selector)
            if c.count() > 0 and c.first.is_visible():
                c.first.hover()
                time.sleep(1.0)

        smooth_scroll(page, distance=300, steps=10)
        time.sleep(1.5)
        smooth_scroll(page, distance=-300, steps=10)

        elapsed = time.time() - t0
        target_dur = durations["scene2_leads"]
        if elapsed < target_dur:
            time.sleep(target_dur - elapsed)

        # -------------------------------------------------------------
        # SCENE 3: Dynamic Deal Desk & Flexible Pricing Negotiation
        # -------------------------------------------------------------
        t0 = time.time()
        print("✨ [Scene 3/8] Recording Deal Desk & Dynamic Pricing Negotiation...")
        page.goto(f"{frontend_url}/leads/create", wait_until="networkidle")
        b, t, d = SAAS_EXPLAINER_SCRIPT["scene3_deal_desk"]
        update_hud(page, b, t, d)
        time.sleep(1.0)

        first_name = page.locator('input[name="first_name"]')
        if first_name.count() > 0 and first_name.first.is_visible():
            first_name.first.click()
            type_naturally(first_name.first, "Victoria")

        last_name = page.locator('input[name="last_name"]')
        if last_name.count() > 0 and last_name.first.is_visible():
            last_name.first.click()
            type_naturally(last_name.first, "Sterling")

        company = page.locator('input[name="company_name"]')
        if company.count() > 0 and company.first.is_visible():
            company.first.click()
            type_naturally(company.first, "Sterling Cloud Corp")

        email = page.locator('input[name="email"]')
        if email.count() > 0 and email.first.is_visible():
            email.first.click()
            type_naturally(email.first, "victoria.sterling@sterlingcloud.io")

        phone = page.locator('input[name="phone"]')
        if phone.count() > 0 and phone.first.is_visible():
            phone.first.click()
            type_naturally(phone.first, "+1 415 889 4210")

        smooth_scroll(page, distance=340, steps=10)
        time.sleep(0.8)

        # Select products
        product_cards = page.locator('.product-selector > div:last-child > div, .product-card-selector')
        count = product_cards.count()
        if count > 0:
            product_cards.nth(0).click()
            time.sleep(1.0)
            if count > 1:
                product_cards.nth(1).click()
                time.sleep(1.0)

        # Negotiate custom unit price
        price_inputs = page.locator('input[title="Change unit price for this lead"], input[name*="unit_price"]')
        if price_inputs.count() > 0:
            price_inputs.first.click()
            price_inputs.first.fill("1250.00")
            time.sleep(1.5)

        smooth_scroll(page, distance=300, steps=8)
        time.sleep(1.5)

        elapsed = time.time() - t0
        target_dur = durations["scene3_deal_desk"]
        if elapsed < target_dur:
            time.sleep(target_dur - elapsed)

        # -------------------------------------------------------------
        # SCENE 4: HERO FEATURE - Customizable Auto-Task Assigning & Rules
        # -------------------------------------------------------------
        t0 = time.time()
        print("⚡ [Scene 4/8] Recording HERO FEATURE: Customizable Auto-Task Assignment...")
        page.goto(f"{frontend_url}/settings?tab=tasks", wait_until="networkidle")
        b, t, d = SAAS_EXPLAINER_SCRIPT["scene4_auto_tasks"]
        update_hud(page, b, t, d)
        time.sleep(1.5)

        # Smooth scroll through active stage task automation rules
        smooth_scroll(page, distance=360, steps=10)
        time.sleep(1.5)
        smooth_scroll(page, distance=-360, steps=10)
        time.sleep(1.0)

        # Open the "New Stage Task Rule" modal to show customization
        new_rule_btn = page.locator('button:has-text("New Stage Task Rule")')
        if new_rule_btn.count() > 0 and new_rule_btn.first.is_visible():
            new_rule_btn.first.click()
            time.sleep(1.5)

            # Select Assignee Strategy dropdown inside modal
            strategy_select = page.locator('select[name="assignee_strategy"]')
            if strategy_select.count() > 0:
                try:
                    strategy_select.first.select_option("ROUND_ROBIN")
                    time.sleep(1.2)
                except Exception:
                    pass

            # Scroll modal to showcase Due Date offset & Mandatory Gate
            modal_body = page.locator('.modal-body, .modal-content')
            if modal_body.count() > 0:
                try:
                    modal_body.first.evaluate('(el) => el.scrollTop += 180')
                    time.sleep(1.0)
                except Exception:
                    pass

            # Close modal
            cancel_btn = page.locator('button:has-text("Cancel")')
            if cancel_btn.count() > 0 and cancel_btn.first.is_visible():
                cancel_btn.first.click()
                time.sleep(1.0)

        # Click tab "Lead Auto-Assignment" to show global routing & round-robin pools
        assignment_tab = page.locator('button[role="tab"]:has-text("Lead Auto-Assignment")')
        if assignment_tab.count() > 0 and assignment_tab.first.is_visible():
            assignment_tab.first.click()
            time.sleep(1.8)
            smooth_scroll(page, distance=250, steps=8)
            time.sleep(1.0)

        elapsed = time.time() - t0
        target_dur = durations["scene4_auto_tasks"]
        if elapsed < target_dur:
            time.sleep(target_dur - elapsed)

        # -------------------------------------------------------------
        # SCENE 5: 360° Lead Workspace & Actionable Task Gates
        # -------------------------------------------------------------
        t0 = time.time()
        print("👤 [Scene 5/8] Recording 360° Customer Profile & Task Execution...")
        page.goto(f"{frontend_url}/leads", wait_until="networkidle")
        b, t, d = SAAS_EXPLAINER_SCRIPT["scene5_workspace"]
        update_hud(page, b, t, d)
        time.sleep(1.5)

        lead_links = page.locator('a[href^="/leads/"]:not([href="/leads/new"]):not([href="/leads/create"])')
        if lead_links.count() > 0:
            lead_links.first.click()
            page.wait_for_load_state("networkidle")
            update_hud(page, b, t, d)
            time.sleep(1.5)

            # Click on Tasks & Pipeline Gates tab
            stage_tasks_tab = page.locator('.hs-tab-btn:has-text("Tasks & Pipeline Gates")')
            if stage_tasks_tab.count() > 0 and stage_tasks_tab.first.is_visible():
                stage_tasks_tab.first.click()
                time.sleep(1.8)
                smooth_scroll(page, distance=250, steps=8)
                time.sleep(1.5)
                smooth_scroll(page, distance=-250, steps=8)
            else:
                smooth_scroll(page, distance=300, steps=10)
                time.sleep(2.0)

        elapsed = time.time() - t0
        target_dur = durations["scene5_workspace"]
        if elapsed < target_dur:
            time.sleep(target_dur - elapsed)

        # -------------------------------------------------------------
        # SCENE 6: Visual Kanban Pipeline & Stage Gate Enforcement
        # -------------------------------------------------------------
        t0 = time.time()
        print("📌 [Scene 6/8] Recording Pipeline Acceleration & Stage Gates...")
        page.goto(f"{frontend_url}/pipeline", wait_until="networkidle")
        b, t, d = SAAS_EXPLAINER_SCRIPT["scene6_pipeline"]
        update_hud(page, b, t, d)
        time.sleep(2.0)
        smooth_scroll(page, distance=250, steps=10)
        time.sleep(2.0)
        smooth_scroll(page, distance=-250, steps=10)

        elapsed = time.time() - t0
        target_dur = durations["scene6_pipeline"]
        if elapsed < target_dur:
            time.sleep(target_dur - elapsed)

        # -------------------------------------------------------------
        # SCENE 7: Real-Time 1-on-1 Deal Collaboration
        # -------------------------------------------------------------
        t0 = time.time()
        print("💬 [Scene 7/8] Recording Real-Time Deal Collaboration...")
        page.goto(f"{frontend_url}/chat", wait_until="networkidle")
        b, t, d = SAAS_EXPLAINER_SCRIPT["scene7_collaboration"]
        update_hud(page, b, t, d)
        time.sleep(1.5)

        chat_contacts = page.locator('.chat-contact-item')
        if chat_contacts.count() > 0:
            chat_contacts.first.click()
            time.sleep(1.0)

            msg_input = page.locator('.chat-input-textarea, textarea[placeholder*="Type a message"]')
            if msg_input.count() > 0 and msg_input.first.is_visible():
                msg_input.first.click()
                type_naturally(msg_input.first, "Victoria Sterling enterprise proposal is approved and stage tasks are completed.")
                time.sleep(0.8)
                send_btn = page.locator('.chat-send-btn, button[title*="Send"]')
                if send_btn.count() > 0 and send_btn.first.is_visible():
                    send_btn.first.click()
                    time.sleep(1.5)

        elapsed = time.time() - t0
        target_dur = durations["scene7_collaboration"]
        if elapsed < target_dur:
            time.sleep(target_dur - elapsed)

        # -------------------------------------------------------------
        # SCENE 8: High-Impact Call to Action (Outro)
        # -------------------------------------------------------------
        t0 = time.time()
        print("🎯 [Scene 8/8] Recording SaaS Finale & Call to Action...")
        page.goto(f"{frontend_url}/dashboard", wait_until="networkidle")
        b, t, d = SAAS_EXPLAINER_SCRIPT["scene8_cta"]
        update_hud(page, b, t, d)
        time.sleep(durations["scene8_cta"])

        print("💾 Closing browser and finalizing video stream...")
        context.close()
        browser.close()

    # 3. Locate the recorded WebM file from Playwright
    recorded_files = list(raw_video_dir.glob("*.webm"))
    if not recorded_files:
        raise RuntimeError("No recorded video found in Playwright output directory.")
    raw_video_file = recorded_files[0]
    print(f"🎬 Raw Playwright video capture: {raw_video_file}")

    # 4. Mux Video + Audio using FFmpeg into MP4 and WebM
    final_mp4 = output_path / "crm_saas_explainer.mp4"
    final_webm = output_path / "crm_saas_explainer.webm"

    print("⚡ Muxing video and master audio into MP4 format (H.264/AAC)...")
    cmd_mp4 = [
        FFMPEG_BIN,
        "-y",
        "-i", str(raw_video_file),
        "-i", str(master_audio_file),
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        str(final_mp4)
    ]
    subprocess.run(cmd_mp4, check=True)

    print("⚡ Muxing video and master audio into WebM format (VP9/Opus)...")
    cmd_webm = [
        FFMPEG_BIN,
        "-y",
        "-i", str(raw_video_file),
        "-i", str(master_audio_file),
        "-c:v", "libvpx-vp9",
        "-crf", "28",
        "-b:v", "0",
        "-c:a", "libopus",
        "-b:a", "128k",
        "-shortest",
        str(final_webm)
    ]
    subprocess.run(cmd_webm, check=True)

    print("\n" + "=" * 70)
    print("🎉 SAAS PRODUCT EXPLAINER VIDEO RECORDED & RENDERED SUCCESSFULLY!")
    print(f"📹 MP4 Format : {final_mp4.resolve()}")
    print(f"🌐 WebM Format: {final_webm.resolve()}")
    print(f"🎵 Audio Track: {master_audio_file.resolve()}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Record CRM SaaS Product Explainer Video with Voiceover")
    parser.add_argument("--headed", action="store_true", help="Run browser in visible mode")
    parser.add_argument("--voice", default="en-US-ChristopherNeural", help="Edge-TTS voice name")
    parser.add_argument("--output", default="demo_videos", help="Output directory for videos")
    args = parser.parse_args()

    record_saas_explainer_video(
        output_dir=args.output,
        headed=args.headed,
        voice=args.voice
    )
