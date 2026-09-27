"""
Diagnostic tool to test real email sending configuration in CRM Lite.
Run with: python backend/check_email.py [recipient_email]
"""
import sys
import os
from pathlib import Path

# Setup Django environment
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.conf import settings
from django.core.mail import send_mail

def main():
    print("=" * 60)
    print("CRM LITE -- EMAIL CONFIGURATION DIAGNOSTIC")
    print("=" * 60)

    backend = getattr(settings, 'EMAIL_BACKEND', '')
    host = getattr(settings, 'EMAIL_HOST', '')
    port = getattr(settings, 'EMAIL_PORT', '')
    user = getattr(settings, 'EMAIL_HOST_USER', '')
    password = getattr(settings, 'EMAIL_HOST_PASSWORD', '')
    tls = getattr(settings, 'EMAIL_USE_TLS', False)
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', '')

    print(f"EMAIL_BACKEND:       {backend}")
    print(f"EMAIL_HOST:          {host}:{port}")
    print(f"EMAIL_USE_TLS:       {tls}")
    print(f"EMAIL_HOST_USER:     {user if user else '<EMPTY>'}")
    masked_pw = '*' * len(password) if password else '<EMPTY>'
    print(f"EMAIL_HOST_PASSWORD: {masked_pw}")
    print(f"DEFAULT_FROM_EMAIL:  {from_email}")
    print("-" * 60)

    # Check for placeholder values
    if not user or user == 'your_email@gmail.com':
        print("[!] ACTION REQUIRED: EMAIL_HOST_USER is still set to placeholder or empty.")
        print("    Open 'backend/.env' and set EMAIL_HOST_USER to your actual email address.")
        return

    if not password or password == 'your_16_digit_app_password':
        print("[!] ACTION REQUIRED: EMAIL_HOST_PASSWORD is still set to placeholder or empty.")
        print("    Open 'backend/.env' and set EMAIL_HOST_PASSWORD to your 16-character App Password.")
        print("    For Gmail: https://myaccount.google.com/apppasswords")
        return

    # Determine recipient
    recipient = sys.argv[1] if len(sys.argv) > 1 else user
    print(f"[*] Attempting to send test email to: {recipient}...")

    try:
        sent = send_mail(
            subject="CRM Lite - Real Email Verification",
            message="Congratulations! Your CRM Lite SMTP email sending is successfully working.",
            from_email=from_email,
            recipient_list=[recipient],
            fail_silently=False,
        )
        if sent:
            print("\n[+] SUCCESS! Test email was successfully sent.")
            print(f"    Please check the inbox of: {recipient}")
            print("    (Also check Spam/Junk folder if not in primary inbox)")
    except Exception as exc:
        print(f"\n[-] FAILED TO SEND EMAIL: {exc}")
        err_str = str(exc)
        if "535" in err_str or "Username and Password not accepted" in err_str:
            print("\n[!] HOW TO FIX (Authentication Error):")
            print("    1. If using Gmail, you CANNOT use your standard Google password.")
            print("    2. Enable 2-Step Verification on your Google Account: https://myaccount.google.com/security")
            print("    3. Generate an App Password: https://myaccount.google.com/apppasswords")
            print("    4. Paste the 16-character code into EMAIL_HOST_PASSWORD in backend/.env.")
        elif "ConnectionRefused" in err_str or "timed out" in err_str:
            print("\n[!] HOW TO FIX (Connection Error):")
            print("    1. Check your internet connection or firewall.")
            print("    2. Ensure port 587 is not blocked by your network/antivirus.")

if __name__ == '__main__':
    main()
