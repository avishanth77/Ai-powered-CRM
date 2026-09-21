import django_filters
from django.db.models import Q
from .models import Lead, LeadSource

class LeadFilter(django_filters.FilterSet):
    status = django_filters.ChoiceFilter(choices=Lead.Status.choices)
    priority = django_filters.ChoiceFilter(choices=Lead.Priority.choices)
    source = django_filters.ModelChoiceFilter(queryset=LeadSource.objects.all())
    assigned_to = django_filters.NumberFilter(field_name='assigned_to__id')
    created_after = django_filters.DateTimeFilter(field_name='created_at', lookup_expr='gte')
    created_before = django_filters.DateTimeFilter(field_name='created_at', lookup_expr='lte')
    updated_after = django_filters.DateTimeFilter(field_name='updated_at', lookup_expr='gte')
    updated_before = django_filters.DateTimeFilter(field_name='updated_at', lookup_expr='lte')
    expected_value_min = django_filters.NumberFilter(field_name='expected_value', lookup_expr='gte')
    expected_value_max = django_filters.NumberFilter(field_name='expected_value', lookup_expr='lte')
    keyword = django_filters.CharFilter(method='filter_keyword')

    class Meta:
        model = Lead
        fields = [
            'status',
            'priority',
            'source',
            'assigned_to',
            'created_after',
            'created_before',
            'updated_after',
            'updated_before',
            'expected_value_min',
            'expected_value_max',
            'keyword',
        ]

    def filter_keyword(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(name__icontains=value) |
            Q(phone__icontains=value) |
            Q(email__icontains=value) |
            Q(company_name__icontains=value)
        )
