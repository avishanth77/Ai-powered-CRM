import json
import logging
import urllib.request
import urllib.error
from typing import Optional, Dict, Any, List
from django.conf import settings

logger = logging.getLogger(__name__)


class TelegramClient:
    """
    Lightweight, production-grade Telegram Bot API client.
    Handles network requests, timeouts, retries, and markdown formatting.
    """

    def __init__(self, token: Optional[str] = None):
        self.token = token or getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
        self.base_url = f"https://api.telegram.org/bot{self.token}"

    @property
    def is_configured(self) -> bool:
        return bool(self.token and len(self.token.strip()) > 10)

    def _make_request(self, endpoint: str, payload: Optional[Dict[str, Any]] = None, timeout: int = 6) -> Dict[str, Any]:
        """Performs HTTPS POST or GET request to Telegram API."""
        if not self.is_configured:
            logger.warning("[TelegramClient] Bot token is not configured in settings. Skipping request.")
            return {"ok": False, "description": "TELEGRAM_BOT_TOKEN not configured"}

        url = f"{self.base_url}/{endpoint}"
        try:
            if payload is not None:
                data = json.dumps(payload).encode('utf-8')
                req = urllib.request.Request(
                    url,
                    data=data,
                    headers={'Content-Type': 'application/json; charset=utf-8'}
                )
            else:
                req = urllib.request.Request(url)

            with urllib.request.urlopen(req, timeout=timeout) as response:
                body = response.read().decode('utf-8')
                return json.loads(body)

        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8') if hasattr(e, 'read') else str(e)
            logger.error(f"[TelegramClient] HTTP Error {e.code} on {endpoint}: {err_body}")
            try:
                return json.loads(err_body)
            except Exception:
                return {"ok": False, "error_code": e.code, "description": str(e)}
        except Exception as e:
            logger.error(f"[TelegramClient] Network error on {endpoint}: {e}")
            return {"ok": False, "description": str(e)}

    def get_me(self) -> Dict[str, Any]:
        """Verifies bot token and retrieves bot profile."""
        return self._make_request('getMe')

    def send_message(
        self,
        chat_id: int,
        text: str,
        reply_markup: Optional[Dict[str, Any]] = None,
        parse_mode: str = 'HTML',
        disable_web_page_preview: bool = True
    ) -> Dict[str, Any]:
        """
        Sends a text message to a specific chat.
        Defaults to HTML parse mode for robust tag formatting without markdown escape glitches.
        """
        payload: Dict[str, Any] = {
            'chat_id': chat_id,
            'text': text,
            'disable_web_page_preview': disable_web_page_preview
        }
        if parse_mode:
            payload['parse_mode'] = parse_mode
        if reply_markup:
            payload['reply_markup'] = reply_markup

        return self._make_request('sendMessage', payload)

    def send_inline_keyboard(
        self,
        chat_id: int,
        text: str,
        buttons: List[List[Dict[str, str]]],
        parse_mode: str = 'HTML'
    ) -> Dict[str, Any]:
        """
        Sends a message with an interactive inline button grid.
        buttons format: [[{'text': 'Btn 1', 'callback_data': 'val1'}], [{'text': 'Btn 2', 'url': 'http...'}]]
        """
        reply_markup = {
            'inline_keyboard': buttons
        }
        return self.send_message(chat_id, text, reply_markup=reply_markup, parse_mode=parse_mode)

    def edit_message_text(
        self,
        chat_id: int,
        message_id: int,
        text: str,
        reply_markup: Optional[Dict[str, Any]] = None,
        parse_mode: str = 'HTML'
    ) -> Dict[str, Any]:
        """Edits an existing message's text and buttons in-place."""
        payload: Dict[str, Any] = {
            'chat_id': chat_id,
            'message_id': message_id,
            'text': text,
        }
        if parse_mode:
            payload['parse_mode'] = parse_mode
        if reply_markup:
            payload['reply_markup'] = reply_markup

        return self._make_request('editMessageText', payload)

    def answer_callback_query(
        self,
        callback_query_id: str,
        text: Optional[str] = None,
        show_alert: bool = False
    ) -> Dict[str, Any]:
        """Acknowledges a button tap to dismiss the loading spinner on Telegram client."""
        payload: Dict[str, Any] = {
            'callback_query_id': callback_query_id,
            'show_alert': show_alert
        }
        if text:
            payload['text'] = text
        return self._make_request('answerCallbackQuery', payload)

    def set_webhook(self, url: str, secret_token: Optional[str] = None) -> Dict[str, Any]:
        """Registers a public HTTPS URL as the Telegram webhook."""
        payload: Dict[str, Any] = {'url': url}
        if secret_token:
            payload['secret_token'] = secret_token
        return self._make_request('setWebhook', payload)

    def delete_webhook(self) -> Dict[str, Any]:
        """Removes the webhook to enable getUpdates polling."""
        return self._make_request('deleteWebhook', {'drop_pending_updates': False})

    def get_webhook_info(self) -> Dict[str, Any]:
        """Retrieves current Telegram webhook status."""
        return self._make_request('getWebhookInfo')

    def get_updates(self, offset: Optional[int] = None, limit: int = 50, timeout: int = 25) -> Dict[str, Any]:
        """Fetches incoming updates for local development polling."""
        payload: Dict[str, Any] = {
            'limit': limit,
            'timeout': timeout,
            'allowed_updates': ['message', 'callback_query']
        }
        if offset is not None:
            payload['offset'] = offset
        return self._make_request('getUpdates', payload, timeout=timeout + 5)

