import json
import urllib.request
import logging
from django.core.management.base import BaseCommand
from django.conf import settings
from telegram_bot.services.telegram_client import TelegramClient

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Sets or removes the Telegram webhook URL (supports auto-detecting running ngrok tunnel)'

    def add_arguments(self, parser):
        parser.add_argument(
            'url',
            nargs='?',
            default=None,
            help='Public HTTPS URL (e.g. https://xxxx.ngrok-free.app). If omitted, attempts to auto-detect from local ngrok.'
        )
        parser.add_argument(
            '--delete',
            action='store_true',
            help='Deletes the active webhook (enables long-polling mode).'
        )
        parser.add_argument(
            '--info',
            action='store_true',
            help='Displays current Telegram webhook configuration and status.'
        )
        parser.add_argument(
            '--secret',
            type=str,
            default=None,
            help='Optional secret token for X-Telegram-Bot-Api-Secret-Token verification.'
        )

    def handle(self, *args, **options):
        client = TelegramClient()

        if not client.is_configured:
            self.stdout.write(self.style.ERROR(
                "\n[ERROR] Telegram Bot Token is not configured.\n"
                "Please add TELEGRAM_BOT_TOKEN to your backend/.env file.\n"
            ))
            return

        # 1. Info / Status check
        if options.get('info'):
            self._show_info(client)
            return

        # 2. Delete webhook
        if options.get('delete'):
            res = client.delete_webhook()
            if res.get('ok'):
                self.stdout.write(self.style.SUCCESS(
                    "\n✅ Telegram webhook removed successfully.\n"
                    "You can now run polling mode with: python backend/manage.py run_telegram_bot\n"
                ))
            else:
                self.stdout.write(self.style.ERROR(
                    f"\n❌ Failed to remove webhook: {res.get('description')}\n"
                ))
            return

        # 3. Determine target webhook URL
        target_url = options.get('url')

        if not target_url:
            self.stdout.write("🔍 No URL provided. Checking local ngrok API (http://127.0.0.1:4040/api/tunnels)...")
            detected_url = self._detect_ngrok_url()
            if detected_url:
                self.stdout.write(self.style.SUCCESS(f"✅ Found active ngrok tunnel: {detected_url}"))
                target_url = detected_url
            else:
                self.stdout.write(self.style.ERROR(
                    "\n[ERROR] Could not auto-detect running ngrok tunnel.\n"
                    "Please either:\n"
                    "  1. Start ngrok first: ngrok http 8000\n"
                    "  2. Or provide the URL explicitly: python backend/manage.py set_telegram_webhook https://xxxx.ngrok-free.app\n"
                ))
                return

        # Normalize URL to ensure it points to the webhook endpoint
        target_url = target_url.strip().rstrip('/')
        if not target_url.startswith('https://'):
            self.stdout.write(self.style.ERROR(
                f"\n[ERROR] Telegram webhooks require an HTTPS URL. Got: {target_url}\n"
            ))
            return

        if not target_url.endswith('/api/telegram/webhook/'):
            if '/api/telegram/webhook' in target_url:
                target_url = target_url.rstrip('/') + '/'
            else:
                target_url = f"{target_url}/api/telegram/webhook/"

        secret_token = options.get('secret') or getattr(settings, 'TELEGRAM_WEBHOOK_SECRET', '')

        self.stdout.write(f"\n📡 Registering webhook with Telegram API...")
        self.stdout.write(f"   Target URL: {target_url}")

        res = client.set_webhook(target_url, secret_token=secret_token or None)

        if res.get('ok'):
            self.stdout.write(self.style.SUCCESS(
                f"\n🎉 Webhook configured successfully!\n"
                f"   Telegram will now forward all messages to:\n"
                f"   {target_url}\n"
            ))
            self._show_info(client)
        else:
            self.stdout.write(self.style.ERROR(
                f"\n❌ Telegram API rejected webhook: {res.get('description')}\n"
            ))

    def _detect_ngrok_url(self):
        """Attempts to read active public HTTPS tunnel from ngrok local web inspection API."""
        try:
            req = urllib.request.Request(
                'http://127.0.0.1:4040/api/tunnels',
                headers={'Accept': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                tunnels = data.get('tunnels', [])
                for t in tunnels:
                    public_url = t.get('public_url', '')
                    if public_url.startswith('https://'):
                        return public_url
        except Exception:
            pass
        return None

    def _show_info(self, client: TelegramClient):
        info = client.get_webhook_info()
        if not info.get('ok'):
            self.stdout.write(self.style.ERROR(f"Could not retrieve webhook info: {info.get('description')}"))
            return

        res = info.get('result', {})
        url = res.get('url', '')
        has_custom_cert = res.get('has_custom_certificate', False)
        pending_count = res.get('pending_update_count', 0)
        last_error_date = res.get('last_error_date')
        last_error_msg = res.get('last_error_message')

        self.stdout.write("\n--- Telegram Webhook Status ---")
        if url:
            self.stdout.write(f"• Active Webhook URL: {url}")
            self.stdout.write(f"• Pending Updates: {pending_count}")
            self.stdout.write(f"• Custom Certificate: {has_custom_cert}")
            if last_error_msg:
                self.stdout.write(self.style.WARNING(f"• Last Error: {last_error_msg} (at {last_error_date})"))
            else:
                self.stdout.write(self.style.SUCCESS("• Health: Normal (No recent delivery errors)"))
        else:
            self.stdout.write("• Status: No active webhook (Polling mode enabled)")
        self.stdout.write("-------------------------------\n")

