import django_filters
from django.utils import timezone
from .models import FollowUp

class FollowUpFilter(django_filters.FilterSet):
    status = django_filters.ChoiceFilter(choices=FollowUp.Status.choices)
    purpose = django_filters.ChoiceFilter(choices=FollowUp.Purpose.choices)
    assigned_to = django_filters.NumberFilter(field_name='assigned_to__id')
    lead = django_filters.NumberFilter(field_name='lead__id')
    customer = django_filters.NumberFilter(field_name='customer__id')
    from_date = django_filters.DateTimeFilter(field_name='follow_up_at', lookup_expr='gte')
    to_date = django_filters.DateTimeFilter(field_name='follow_up_at', lookup_expr='lte')
    is_overdue = django_filters.BooleanFilter(method='filter_is_overdue')

    class Meta:
        model = FollowUp
        fields = ['status', 'purpose', 'assigned_to', 'lead', 'customer', 'from_date', 'to_date', 'is_overdue']

    def filter_is_overdue(self, queryset, name, value):
        if value is True:
            return queryset.filter(status=FollowUp.Status.PENDING, follow_up_at__lt=timezone.now())
        elif value is False:
            return queryset.exclude(status=FollowUp.Status.PENDING, follow_up_at__lt=timezone.now())
        return queryset
