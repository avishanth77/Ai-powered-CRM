# Automated CRM Feature Walkthrough Video Recording Guide

This guide explains how to generate a complete, 1080p high-definition product walkthrough video of the CRM application using CLI automation (Playwright), AI agents (Codex / Antigravity / Claude Code), or Cloud CI pipelines.

---

## 1. How It Works (The Architecture)

Instead of manually recording with screen-capture software (which can be shaky, inconsistent, or have background noise), the automated recorder uses **Browser Automation via Playwright**:

1. **Pixel-Perfect 1080p HD Output**: Launches Google Chrome directly in 1920×1080 viewport with native 60fps recording enabled.
2. **Automated JWT Authentication**: Instantly provisions an Admin JWT session directly in browser storage, eliminating manual login hiccups.
3. **Smooth Animated Cursor**: Injects a glowing cursor overlay (`#10b981`) so viewers can track every click, hover, and scroll naturally.
4. **End-to-End Tour of All Major Features**:
   - **Scene 1: Executive Dashboard**: KPI cards, pipeline conversion funnel, recent activity.
   - **Scene 2: Kanban Sales Pipeline**: Horizontal board navigation, deal cards, task checkpoints.
   - **Scene 3: Lead Creation & Product Pricing**:
     - Form input with realistic human typing speed.
     - Selecting multiple items in **Interested Products**.
     - Displaying the **Default Price vs Changed Price** breakdown in the **Expected Deal Value** area.
     - Negotiating a custom price and demonstrating real-time updates to **Deal Preview**.
   - **Scene 4: 1-on-1 Direct Team Chat**:
     - Opening `/chat`, selecting a team member, and sending an instant message.
   - **Scene 5: 3-Column HubSpot Lead View**:
     - Demographics, activity history, and PLD qualification criteria.
   - **Scene 6: Settings & Catalog**:
     - Lead stages, products catalog, and Web-to-Lead API integration.

---

## 2. Running Locally via CLI / Codex

The recording script is located at [`scripts/record_crm_demo.py`](file:///d:/texol/final%20project%20ai/scripts/record_crm_demo.py).

### Prerequisites
Both frontend and backend development servers must be running:
```bash
# Terminal 1: Backend
python backend/manage.py runserver 8000

# Terminal 2: Frontend
npm --prefix frontend run dev
```

### Command Options

#### A. Headless Mode (Fast, silent background recording):
```bash
python scripts/record_crm_demo.py
```

#### B. Headed Mode (Watch Chrome record the demo live like a movie!):
```bash
python scripts/record_crm_demo.py --headed
```

#### C. Presentation / Slower Pace:
Adjust pacing (in milliseconds per action) for a more deliberate walkthrough:
```bash
python scripts/record_crm_demo.py --headed --slowmo 500
```

### Video Output Location
The generated video is saved to:
```
demo_videos/crm_full_feature_walkthrough.webm
```

---

## 3. Running via Codex or AI Coding Agents

If you are using **Codex**, **Antigravity**, or **Claude Code**, simply prompt the agent:

> *"Run the automated demo recorder script in `scripts/record_crm_demo.py` and notify me when the video is ready in `demo_videos/`."*

The agent will execute the script, monitor the progress, and provide the file path upon completion.

---

## 4. Running in the Cloud (GitHub Actions CI/CD)

To generate updated demo videos automatically on every push or on-demand via a GitHub workflow button, add this workflow file to `.github/workflows/record_demo.yml`:

```yaml
name: Generate CRM Demo Video

on:
  workflow_dispatch: # Allows clicking "Run workflow" in GitHub UI
  push:
    branches: [main, features]

jobs:
  record-demo:
    runs-on: ubuntu-latest

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Backend Dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r backend/requirements.txt
          pip install playwright
          python -m playwright install --with-deps chromium ffmpeg

      - name: Install Frontend Dependencies
        run: |
          npm --prefix frontend install

      - name: Run Migrations & Start Backend
        run: |
          python backend/manage.py migrate
          python backend/manage.py runserver 8000 &
        env:
          DJANGO_SETTINGS_MODULE: config.settings

      - name: Build & Start Frontend
        run: |
          npm --prefix frontend run build
          npm --prefix frontend run preview -- --port 5173 &

      - name: Wait for services to be healthy
        run: |
          npx wait-on http://localhost:8000/api/ http://localhost:5173/

      - name: Run Demo Recording Script
        run: |
          python scripts/record_crm_demo.py --url http://localhost:5173

      - name: Upload Demo Video Artifact
        uses: actions/upload-artifact@v4
        with:
          name: crm-full-feature-demo-video
          path: demo_videos/crm_full_feature_walkthrough.webm
          retention-days: 14
```

---

## 5. Adding AI Voiceover & Finishing Touches

To turn this video into a marketing or investor-ready presentation:

1. **AI Voiceover (ElevenLabs / Edge-TTS)**:
   - Generate audio narration matching the 6 scenes.
   - Use `ffmpeg` to merge audio with the recording:
     ```bash
     ffmpeg -i demo_videos/crm_full_feature_walkthrough.webm -i narration.mp3 -c:v copy -c:a aac demo_videos/crm_demo_narrated.mp4
     ```
2. **Screen Studio / Clipchamp / Loom**:
   - Import the video into Screen Studio or Clipchamp to add zoom-ins on key buttons, subtitle captions, and chapter titles.
