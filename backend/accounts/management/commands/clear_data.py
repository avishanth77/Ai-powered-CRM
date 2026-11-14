from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth import get_user_model
from leads.models import (
    Lead, LeadNote, LeadHandover, InternalComment, CommentMention,
    LeadStageTask, CustomPropertyValue
)
from customers.models import Customer
from followups.models import FollowUp
from activity.models import ActivityLog
from notifications.models import Notification
from accounts.models import StaffTarget
from products.models import LeadProduct, CustomerProduct, Product
from ai.models import AICall
from telegram_bot.models import TelegramActionSession

User = get_user_model()


class Command(BaseCommand):
    help = 'Clears all CRM data, transactional records, and non-admin users, keeping only superuser/admin accounts.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--include-products',
            action='store_true',
            help='Also delete the Product catalog',
        )

    def handle(self, *args, **options):
        include_products = options.get('include_products', False)
        self.stdout.write("Clearing CRM database while keeping admin...")

        with transaction.atomic():
            # 1. Activities and Notifications
            Notification.objects.all().delete()
            ActivityLog.objects.all().delete()

            # 2. Follow-ups
            FollowUp.objects.all().delete()

            # 3. Product assignments
            LeadProduct.objects.all().delete()
            CustomerProduct.objects.all().delete()
            if include_products:
                Product.objects.all().delete()

            # 4. Comments & Mentions
            CommentMention.objects.all().delete()
            InternalComment.objects.all().delete()

            # 5. Lead tasks & handovers & notes & custom properties
            LeadStageTask.objects.all().delete()
            LeadHandover.objects.all().delete()
            LeadNote.objects.all().delete()
            CustomPropertyValue.objects.all().delete()

            # 6. Leads & Customers
            Lead.objects.all().delete()
            Customer.objects.all().delete()

            # 7. Staff targets
            StaffTarget.objects.all().delete()

            # 8. AI & Telegram logs/sessions
            AICall.objects.all().delete()
            TelegramActionSession.objects.all().delete()

            # 9. Non-admin users (preserve superusers)
            deleted_users, _ = User.objects.filter(is_superuser=False).delete()

            # Count remaining admins
            admins = User.objects.filter(is_superuser=True)
            admin_emails = ', '.join([a.email for a in admins])
            self.stdout.write(self.style.SUCCESS(
                f"Successfully cleared database! {deleted_users} non-admin user(s) removed. "
                f"{admins.count()} admin account(s) preserved: {admin_emails}"
            ))
