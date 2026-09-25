import django_filters
from django.db.models import Q
from .models import Lead, LeadSource, LeadStage

class LeadFilter(django_filters.FilterSet):
    stage = django_filters.ModelChoiceFilter(queryset=LeadStage.objects.all())
    status = django_filters.CharFilter(method='filter_status')
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
            'stage',
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

    def filter_status(self, queryset, name, value):
        if not value:
            return queryset
        val = value.strip()
        q = Q(stage__slug__iexact=val.lower().replace('_', '-')) | Q(stage__slug__iexact=val) | Q(stage__name__iexact=val)
        if val.isdigit():
            q |= Q(stage__id=int(val))
        return queryset.filter(q)

    def filter_keyword(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(
            Q(name__icontains=value) |
            Q(phone__icontains=value) |
            Q(email__icontains=value) |
            Q(company_name__icontains=value)
        )
