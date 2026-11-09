import time
import logging
from django.core.management.base import BaseCommand
from django.conf import settings
from telegram_bot.services.telegram_client import TelegramClient
from telegram_bot.services.telegram_handler import TelegramUpdateHandler

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Runs the Telegram CRM Bot in long-polling mode (ideal for local development without ngrok or public HTTPS)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--drop-pending',
            action='store_true',
            help='Drop any pending updates queued in Telegram before starting'
        )

    def handle(self, *args, **options):
        client = TelegramClient()

        if not client.is_configured:
            self.stdout.write(self.style.ERROR(
                "\n[ERROR] Telegram Bot Token is not configured.\n"
                "Please add TELEGRAM_BOT_TOKEN to your backend/.env file.\n"
                "To get a token, open Telegram, message @BotFather, and type /newbot.\n"
            ))
            return

        bot_info = client.get_me()
        if not bot_info.get('ok'):
            self.stdout.write(self.style.ERROR(
                f"\n[ERROR] Failed to connect to Telegram API with provided token: {bot_info.get('description')}\n"
            ))
            return

        bot_user = bot_info.get('result', {})
        bot_name = bot_user.get('first_name', 'CRM Bot')
        bot_handle = bot_user.get('username', 'crm_bot')

        self.stdout.write(self.style.SUCCESS(
            f"\n======================================================\n"
            f"🤖 CRM Lite Telegram Bot Active (Long-Polling Mode)\n"
            f"   Bot: {bot_name} (@{bot_handle})\n"
            f"   Ready to receive messages and commands.\n"
            f"   Press CTRL+C to stop.\n"
            f"======================================================\n"
        ))

        # Clear any existing webhook so polling can receive updates
        client.delete_webhook()

        handler = TelegramUpdateHandler(client=client)
        offset = None

        if options.get('drop_pending'):
            updates = client.get_updates(timeout=1)
            if updates.get('ok') and updates.get('result'):
                offset = updates['result'][-1]['update_id'] + 1
                self.stdout.write(self.style.WARNING(f"Dropped {len(updates['result'])} pending updates."))

        while True:
            try:
                res = client.get_updates(offset=offset, timeout=20)
                if res.get('ok'):
                    for update in res.get('result', []):
                        offset = update['update_id'] + 1
                        update_type = "message" if "message" in update else ("callback" if "callback_query" in update else "other")
                        from_user = update.get('message', {}).get('from', {}).get('username') or update.get('callback_query', {}).get('from', {}).get('username') or 'User'
                        self.stdout.write(f"[{time.strftime('%H:%M:%S')}] Received {update_type} from @{from_user}")

                        handler.handle_update(update)
                else:
                    self.stdout.write(self.style.WARNING(f"Polling returned: {res.get('description')}"))
                    time.sleep(3)

            except KeyboardInterrupt:
                self.stdout.write(self.style.SUCCESS("\n[CRM Bot] Polling loop stopped gracefully."))
                break
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"[CRM Bot] Polling error: {e}"))
                time.sleep(3)

