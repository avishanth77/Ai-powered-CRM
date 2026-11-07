import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { leadApi } from '../api/leadApi';
import { reportApi } from '../api/reportApi';
import { productApi } from '../api/productApi';
import { followupApi } from '../api/followupApi';
import { activityApi } from '../api/activityApi';
import { userApi } from '../api/userApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate, formatDateTime, toLocalDateTimeInput } from '../utils/formatters';
import { extractErrorMessage } from '../utils/validation';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { LEAD_STATUS, LEAD_PRIORITY, FOLLOWUP_PURPOSES, ICP_STATUS_CONFIG, PLD_STATUS, PLD_STATUS_CONFIG } from '../utils/constants';
import { IcpStatusBadge } from '../components/IcpStatusBadge';
import { PldStatusBadge } from '../components/PldStatusBadge';

import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import { SearchBar } from '../components/SearchBar';
import { Pagination } from '../components/Pagination';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { ConfirmModal } from '../components/ConfirmModal';

import {
  Eye,
  Edit,
  Trash2,
  Plus,
  Filter,
  Phone,
  Mail,
  Users,
  Sparkles,
  CheckCircle2,
  Flame,
  TrendingUp,
  ChevronRight,
  ArrowRight,
  Calendar,
  CalendarPlus,
  Clock,
  Download,
  UploadCloud,
  Kanban,
  Activity,
  UserPlus,
  FileSpreadsheet,
  Share2,
  Package,
  CheckSquare,
  SlidersHorizontal,
  Settings2,
  Table,
  RefreshCw,
  AlertCircle,
  Check,
  X,
} from 'lucide-react';

const TARGET_CRM_FIELDS = [
  { value: 'name', label: '👤 Lead / Contact Name' },
  { value: 'phone', label: '📞 Phone Number' },
  { value: 'email', label: '✉️ Email Address' },
  { value: 'company_name', label: '🏢 Company / Organization' },
  { value: 'expected_value', label: '💰 Expected Deal Value (₹)' },
  { value: 'priority', label: '⚡ Priority (LOW/MED/HIGH/URGENT)' },
  { value: 'source', label: '🌐 Lead Source' },
  { value: 'status', label: '📊 Initial Stage / Status' },
  { value: 'address', label: '📍 Address / Location' },
  { value: 'skip', label: '🚫 Skip / Do Not Import' },
];

const INITIAL_TEMPLATE_FIELDS = [
  { key: 'name', label: 'Lead Name', customHeader: 'Name', enabled: true, sample: 'Aarav Sharma', sample2: 'Sara Khan' },
  { key: 'phone', label: 'Phone Number', customHeader: 'Phone', enabled: true, sample: '+919876543210', sample2: '+919123456780' },
  { key: 'email', label: 'Email Address', customHeader: 'Email', enabled: true, sample: 'aarav@example.com', sample2: 'sara@example.com' },
  { key: 'company_name', label: 'Company / Organization', customHeader: 'Company', enabled: true, sample: 'Apex Traders', sample2: 'Bright Retail' },
  { key: 'expected_value', label: 'Expected Deal Value', customHeader: 'Expected Value', enabled: true, sample: '75000', sample2: '25000' },
  { key: 'priority', label: 'Priority', customHeader: 'Priority', enabled: true, sample: 'HIGH', sample2: 'MEDIUM' },
  { key: 'source', label: 'Lead Source', customHeader: 'Source', enabled: true, sample: 'Website', sample2: 'Referral' },
  { key: 'status', label: 'Initial Stage', customHeader: 'Stage', enabled: false, sample: 'New', sample2: 'New' },
  { key: 'address', label: 'Address / Location', customHeader: 'Address', enabled: true, sample: 'Mumbai', sample2: 'Delhi' },
];

const CRM_FIELD_PRESETS = [
  { preset: 'custom', label: 'Custom Field (Define Your Own)', defaultKey: '', defaultHeader: '', defaultSample: 'Custom Value' },
  { preset: 'notes', label: 'Initial Notes / Inquiry Details', defaultKey: 'notes', defaultHeader: 'Notes', defaultSample: 'Customer inquired about enterprise annual plan' },
  { preset: 'designation', label: 'Job Title / Designation', defaultKey: 'designation', defaultHeader: 'Job Title', defaultSample: 'Chief Technology Officer' },
  { preset: 'industry', label: 'Industry / Sector', defaultKey: 'industry', defaultHeader: 'Industry', defaultSample: 'Information Technology' },
  { preset: 'website', label: 'Website / Domain', defaultKey: 'website', defaultHeader: 'Website', defaultSample: 'https://example.com' },
  { preset: 'products', label: 'Product Interest', defaultKey: 'products', defaultHeader: 'Product', defaultSample: 'Enterprise Suite' },
  { preset: 'city', label: 'City / Town', defaultKey: 'city', defaultHeader: 'City', defaultSample: 'Bengaluru' },
  { preset: 'state', label: 'State / Province', defaultKey: 'state', defaultHeader: 'State', defaultSample: 'Karnataka' },
  { preset: 'country', label: 'Country', defaultKey: 'country', defaultHeader: 'Country', defaultSample: 'India' },
  { preset: 'postal_code', label: 'Postal Code / PIN', defaultKey: 'postal_code', defaultHeader: 'Postal Code', defaultSample: '560001' },
  { preset: 'first_name', label: 'First Name', defaultKey: 'first_name', defaultHeader: 'First Name', defaultSample: 'Aarav' },
  { preset: 'last_name', label: 'Last Name', defaultKey: 'last_name', defaultHeader: 'Last Name', defaultSample: 'Sharma' },
];

const parseCsvSnippet = (csvText) => {
  const lines = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuote = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c !== '')) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== '')) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) return { headers: [], rows: [], totalRowCount: 0 };
  const headers = lines[0].map((h) => h.replace(/^["']|["']$/g, '').trim());
  const rows = lines.slice(1, 4).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] !== undefined ? r[idx] : '';
    });
    return obj;
  });

  return { headers, rows, totalRowCount: Math.max(0, lines.length - 1) };
};

const guessTargetField = (headerName) => {
  const norm = (headerName || '').toLowerCase().trim().replace(/[-_\s]+/g, ' ');
  if (/name|contact person|prospect|client name|customer/i.test(norm)) return 'name';
  if (/phone|mobile|cell|contact num|tel|whatsapp/i.test(norm)) return 'phone';
  if (/email|e[-_]?mail|mail/i.test(norm)) return 'email';
  if (/company|organization|organisation|firm|business|account/i.test(norm)) return 'company_name';
  if (/value|deal|amount|revenue|worth|budget|price|expected/i.test(norm)) return 'expected_value';
  if (/priority|urgency|tier/i.test(norm)) return 'priority';
  if (/source|channel|campaign|medium|origin/i.test(norm)) return 'source';
  if (/stage|status|pipeline state/i.test(norm)) return 'status';
  if (/address|city|location|state|country/i.test(norm)) return 'address';
  return 'skip';
};

export const Leads = () => {
  const { user, canDeleteLeads, canHandoverLeads } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Primary Leads State
  const [leads, setLeads] = useState([]);
  const [sources, setSources] = useState([]);
  const [stages, setStages] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [icpStatusFilter, setIcpStatusFilter] = useState('');
  const [pldStatusFilter, setPldStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [availableProducts, setAvailableProducts] = useState([]);

  // Bulk Handover State
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkTarget, setBulkTarget] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Dashboard Enrichment State
  const [kpis, setKpis] = useState(null);
  const [followups, setFollowups] = useState([]);
  const [activities, setActivities] = useState([]);
  const [panelsLoading, setPanelsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  // Guards against out-of-order list responses on rapid filter changes
  const leadsRequestId = useRef(0);
  const selectAllRef = useRef(null);

  // Modals
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importActiveTab, setImportActiveTab] = useState('upload'); // 'upload' | 'builder'
  const [selectedFile, setSelectedFile] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvPreviewRows, setCsvPreviewRows] = useState([]);
  const [csvTotalRows, setCsvTotalRows] = useState(0);
  const [columnMapping, setColumnMapping] = useState({});
  const [defaultImportStage, setDefaultImportStage] = useState('');
  const [defaultImportPriority, setDefaultImportPriority] = useState('');
  const [availableCrmFields, setAvailableCrmFields] = useState(TARGET_CRM_FIELDS);
  const [templateFields, setTemplateFields] = useState(INITIAL_TEMPLATE_FIELDS);
  const [showPreviewTable, setShowPreviewTable] = useState(true);
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldPreset, setNewFieldPreset] = useState('custom');
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldHeader, setNewFieldHeader] = useState('');
  const [newFieldSample, setNewFieldSample] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  // Dialog accessibility: Escape to close, focus trap, body scroll lock
  const scheduleDialogRef = useDialogA11y(scheduleModalOpen, () => setScheduleModalOpen(false));
  const importDialogRef = useDialogA11y(importModalOpen, () => setImportModalOpen(false));
  const bulkDialogRef = useDialogA11y(bulkModalOpen, () => setBulkModalOpen(false));

  const [newFollowup, setNewFollowup] = useState({
    lead: '',
    purpose: 'Phone Call',
    follow_up_at: '',
  });

  // Load Lead Sources, Dynamic Stages, and Executives
  useEffect(() => {
    leadApi
      .getSources()
      .then((res) => {
        if (res.results) setSources(res.results);
        else if (Array.isArray(res)) setSources(res);
      })
      .catch(() => {});

    leadApi
      .getStages()
      .then((res) => {
        setStages(res.results || (Array.isArray(res) ? res : []));
      })
      .catch(() => {});

    if (canHandoverLeads) {
      userApi
        .getUsers()
        .then((res) => {
          const list = res.results || (Array.isArray(res) ? res : []);
          setExecutives(list.filter((u) => u.is_active && u.role === 'EXECUTIVE'));
        })
        .catch(() => {});
    }

    productApi
      .getSimpleProducts()
      .then((data) => setAvailableProducts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [canHandoverLeads]);

  // Fetch KPI Summary Data
  const fetchKpis = useCallback(async () => {
    try {
      const res = await reportApi.getSummary();
      if (res?.data) {
        setKpis(res.data);
      }
    } catch {
      // Fallback will calculate from leads array
    }
  }, []);

  // Fetch Upcoming Follow-ups
  const fetchUpcomingFollowups = useCallback(async () => {
    try {
      const res = await followupApi.getFollowUps({ page_size: 4, ordering: 'follow_up_at', status: 'PENDING' });
      const items = res?.results || res?.data || (Array.isArray(res) ? res : []);
      setFollowups(items);
    } catch {
      // keep previously loaded items on refresh failure
    }
  }, []);

  // Fetch Recent Activity Logs
  const fetchRecentActivity = useCallback(async () => {
    try {
      const res = await activityApi.getActivities({ page_size: 6 });
      const items = res?.results || (Array.isArray(res) ? res : []);
      setActivities(items);
    } catch {
      // keep previously loaded items on refresh failure
    }
  }, []);

  useEffect(() => {
    fetchKpis();
    setPanelsLoading(true);
    Promise.allSettled([fetchUpcomingFollowups(), fetchRecentActivity()]).then(() =>
      setPanelsLoading(false)
    );
  }, [fetchKpis, fetchUpcomingFollowups, fetchRecentActivity]);

  // Partial selection state for the select-all checkbox
  const isPartialSelection = selectedLeads.length > 0 && selectedLeads.length < leads.length;
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isPartialSelection;
    }
  }, [isPartialSelection, leads.length]);

  const fetchLeads = useCallback(async () => {
    const requestId = ++leadsRequestId.current;
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        keyword: search || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        icp_status: icpStatusFilter || undefined,
        pld_status: pldStatusFilter || undefined,
        source: sourceFilter || undefined,
        assigned_to: assignedToFilter || undefined,
        product: productFilter || undefined,
      };

      const res = await leadApi.getLeads(params);
      if (requestId !== leadsRequestId.current) return; // stale response
      if (res.results) {
        setLeads(res.results);
        setTotalCount(res.count || res.results.length);
      } else if (Array.isArray(res)) {
        setLeads(res);
        setTotalCount(res.length);
      }
    } catch (err) {
      if (requestId !== leadsRequestId.current) return; // stale response
      showToast(extractErrorMessage(err, 'Failed to fetch leads'), 'error');
    } finally {
      if (requestId === leadsRequestId.current) setLoading(false);
    }
  }, [currentPage, search, statusFilter, priorityFilter, icpStatusFilter, pldStatusFilter, sourceFilter, assignedToFilter, productFilter, showToast]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleSearchChange = (val) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const handlePriorityChange = (e) => {
    setPriorityFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleIcpStatusChange = (e) => {
    setIcpStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const handlePldStatusChange = (e) => {
    setPldStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleSourceChange = (e) => {
    setSourceFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleAssignedToChange = (e) => {
    setAssignedToFilter(e.target.value);
    setCurrentPage(1);
  };

  // Bulk Selection Handlers
  const handleToggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedLeads(leads.map((l) => l.id));
    } else {
      setSelectedLeads([]);
    }
  };

  const handleToggleSelect = (leadId) => {
    setSelectedLeads((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    );
  };

  const handleConfirmBulkHandover = async (e) => {
    e.preventDefault();
    if (!bulkTarget || selectedLeads.length === 0) return;
    if (!bulkReason.trim()) {
      showToast('Please provide a handover reason.', 'warning');
      return;
    }

    setBulkSubmitting(true);
    try {
      const res = await leadApi.bulkHandover({
        lead_ids: selectedLeads,
        new_assigned_to: parseInt(bulkTarget),
        reason: bulkReason.trim(),
      });
      showToast(res.message || `Successfully handed over ${selectedLeads.length} lead(s).`, 'success');
      setBulkModalOpen(false);
      setSelectedLeads([]);
      setBulkTarget('');
      setBulkReason('');
      fetchLeads();
      fetchKpis();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Bulk handover failed'), 'error');
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Pipeline stage click filter
  // Stage keys use the uppercase-with-underscores form ('NEW', 'DEMO_SCHEDULED'),
  // matching the report API and the <select> option values below.
  const normalizeStageKey = (value) => (value || '').toUpperCase().replace(/[- ]/g, '_');

  const handleStageClick = (stageKey) => {
    if (statusFilter === stageKey) {
      setStatusFilter(''); // Toggle off
    } else {
      setStatusFilter(stageKey);
    }
    setCurrentPage(1);
  };

  const handleOpenDelete = (lead) => {
    setLeadToDelete(lead);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!leadToDelete) return;
    setDeleting(true);
    try {
      await leadApi.deleteLead(leadToDelete.id);
      showToast(`Lead "${leadToDelete.name}" was successfully deleted.`, 'success');
      setDeleteModalOpen(false);
      setLeadToDelete(null);
      // Avoid landing on an empty page when deleting the last row
      if (leads.length <= 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else {
        fetchLeads();
      }
      fetchKpis();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to delete lead'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Quick Export (mirrors the active table filters)
  const handleExportLeads = async () => {
    setExporting(true);
    try {
      await reportApi.downloadExportCsv({
        keyword: search || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        source: sourceFilter || undefined,
        assigned_to: assignedToFilter || undefined,
      });
      showToast('Leads CSV exported successfully!', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Export failed'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleOpenScheduleForLead = (lead) => {
    setNewFollowup({
      lead: lead.id.toString(),
      purpose: 'Phone Call',
      follow_up_at: '',
    });
    setScheduleModalOpen(true);
  };

  // Quick Schedule Follow-up
  const handleQuickScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!newFollowup.lead || !newFollowup.follow_up_at) {
      showToast('Please select a lead and date/time.', 'warning');
      return;
    }
    setScheduling(true);
    try {
      await followupApi.createFollowUp({
        lead: parseInt(newFollowup.lead),
        purpose: newFollowup.purpose,
        follow_up_at: new Date(newFollowup.follow_up_at).toISOString(),
        assigned_to: user?.id,
      });
      showToast('Follow-up scheduled successfully!', 'success');
      setScheduleModalOpen(false);
      setNewFollowup({ lead: '', purpose: 'Phone Call', follow_up_at: '' });
      fetchUpcomingFollowups();
      fetchKpis();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to schedule follow-up'), 'error');
    } finally {
      setScheduling(false);
    }
  };

  // Import Leads via CSV upload
  const MAX_IMPORT_SIZE = 10 * 1024 * 1024;

  const handleImportFile = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showToast('Invalid file type. Please select a .csv file.', 'error');
      return;
    }
    if (file.size > MAX_IMPORT_SIZE) {
      showToast('File is too large. Maximum allowed size is 10MB.', 'error');
      return;
    }
    setImportResult(null);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const { headers, rows, totalRowCount } = parseCsvSnippet(text);
        setCsvHeaders(headers);
        setCsvPreviewRows(rows);
        setCsvTotalRows(totalRowCount);

        const initialMap = {};
        headers.forEach((h) => {
          initialMap[h] = guessTargetField(h);
        });
        setColumnMapping(initialMap);

        // Update template builder with detected header names
        setTemplateFields((prev) =>
          prev.map((field) => {
            const matchedHeader = headers.find((h) => initialMap[h] === field.key);
            if (matchedHeader) {
              return { ...field, customHeader: matchedHeader, enabled: true };
            }
            return field;
          })
        );
      } catch (err) {
        console.error('Failed to parse CSV preview', err);
      }
    };
    reader.readAsText(file);
  };

  const handleColumnMapChange = (header, targetField) => {
    setColumnMapping((prev) => ({
      ...prev,
      [header]: targetField,
    }));
  };

  const handleResetMapping = () => {
    const freshMap = {};
    csvHeaders.forEach((h) => {
      freshMap[h] = guessTargetField(h);
    });
    setColumnMapping(freshMap);
    showToast('Reset column mapping to auto-detected CRM fields', 'info');
  };

  const handleDownloadTemplate = () => {
    const headers = ['Name', 'Phone', 'Email', 'Company', 'Source', 'Priority', 'Expected Value', 'Address'];
    const rows = [
      ['Aarav Sharma', '+919876543210', 'aarav@example.com', 'Apex Traders', 'Website', 'HIGH', '75000', 'Mumbai'],
      ['Sara Khan', '+919123456780', 'sara@example.com', 'Bright Retail', 'Referral', 'MEDIUM', '25000', 'Delhi'],
    ];
    const escapeCell = (cell) => `"${String(cell).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crm_lite_leads_import_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    showToast('Sample template downloaded!', 'info');
  };

  // Download a CSV template customized to the exact structure of the uploaded CSV
  const handleDownloadMatchingTemplate = () => {
    if (!csvHeaders || csvHeaders.length === 0) {
      showToast('Please select or drop a CSV file first.', 'warning');
      return;
    }
    const sampleLookup1 = {
      name: 'Aarav Sharma',
      phone: '+919876543210',
      email: 'aarav.sharma@example.com',
      company_name: 'Apex Traders Pvt Ltd',
      expected_value: '75000',
      priority: 'HIGH',
      source: 'Website',
      status: 'New',
      address: 'Mumbai, Maharashtra',
      skip: 'Sample Note',
    };
    const sampleLookup2 = {
      name: 'Sara Khan',
      phone: '+919123456780',
      email: 'sara.khan@brightretail.in',
      company_name: 'Bright Retailers',
      expected_value: '25000',
      priority: 'MEDIUM',
      source: 'Referral',
      status: 'New',
      address: 'New Delhi',
      skip: 'Sample Note',
    };

    const escapeCell = (cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
    const row1 = csvHeaders.map((h) => {
      const target = columnMapping[h];
      const matched = templateFields.find((f) => f.key === target);
      if (matched) return matched.sample;
      return sampleLookup1[target] || 'Sample 1';
    });
    const row2 = csvHeaders.map((h) => {
      const target = columnMapping[h];
      const matched = templateFields.find((f) => f.key === target);
      if (matched) return matched.sample2 || matched.sample;
      return sampleLookup2[target] || 'Sample 2';
    });

    const csv = [csvHeaders, row1, row2].map((r) => r.map(escapeCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = (selectedFile?.name || 'leads_template').replace(/\.csv$/i, '');
    a.download = `${baseName}_custom_template.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    showToast('Customized CSV template matching uploaded structure downloaded!', 'success');
  };

  const handlePresetChange = (presetKey) => {
    setNewFieldPreset(presetKey);
    const found = CRM_FIELD_PRESETS.find((p) => p.preset === presetKey);
    if (found && presetKey !== 'custom') {
      setNewFieldKey(found.defaultKey);
      setNewFieldLabel(found.label.split('/')[0].trim());
      setNewFieldHeader(found.defaultHeader);
      setNewFieldSample(found.defaultSample);
    } else {
      setNewFieldKey('');
      setNewFieldLabel('');
      setNewFieldHeader('');
      setNewFieldSample('');
    }
  };

  const handleAddCrmField = (e) => {
    if (e) e.preventDefault();
    const label = (newFieldLabel || '').trim();
    if (!label) {
      showToast('Please enter a field name in CRM.', 'warning');
      return;
    }
    const header = (newFieldHeader || label).trim();
    const cleanKey = (newFieldKey.trim() || label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')) || 'custom_field';

    if (templateFields.some((f) => f.key === cleanKey)) {
      showToast(`Field '${label}' already exists in template.`, 'warning');
      return;
    }

    const newFieldObj = {
      key: cleanKey,
      label,
      customHeader: header,
      enabled: true,
      sample: (newFieldSample || 'Sample Value').trim(),
      sample2: (newFieldSample || 'Sample Value').trim(),
      isCustom: true,
    };

    setTemplateFields((prev) => [...prev, newFieldObj]);

    setAvailableCrmFields((prev) => {
      const skipItem = prev.find((opt) => opt.value === 'skip');
      const filtered = prev.filter((opt) => opt.value !== 'skip' && opt.value !== cleanKey);
      return [
        ...filtered,
        { value: cleanKey, label: `✨ ${label}` },
        ...(skipItem ? [skipItem] : []),
      ];
    });

    showToast(`Added CRM Field '${label}' to template and mapping!`, 'success');
    setShowAddFieldModal(false);
    setNewFieldPreset('custom');
    setNewFieldKey('');
    setNewFieldLabel('');
    setNewFieldHeader('');
    setNewFieldSample('');
  };

  const handleRemoveCustomField = (keyToRemove) => {
    setTemplateFields((prev) => prev.filter((f) => f.key !== keyToRemove));
    setAvailableCrmFields((prev) => prev.filter((opt) => opt.value !== keyToRemove));
    setColumnMapping((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((header) => {
        if (updated[header] === keyToRemove) {
          updated[header] = 'skip';
        }
      });
      return updated;
    });
    showToast('Custom field removed', 'info');
  };

  const handleToggleTemplateField = (key) => {
    setTemplateFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f))
    );
  };

  const handleUpdateTemplateHeader = (key, customHeader) => {
    setTemplateFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, customHeader } : f))
    );
  };

  const handleSelectAllTemplateFields = (selectState) => {
    setTemplateFields((prev) => prev.map((f) => ({ ...f, enabled: selectState })));
  };

  const handleDownloadCustomBuilderTemplate = () => {
    const active = templateFields.filter((f) => f.enabled);
    if (active.length === 0) {
      showToast('Please select at least one field for your custom template.', 'warning');
      return;
    }
    const headers = active.map((f) => f.customHeader.trim() || f.label);
    const row1 = active.map((f) => f.sample);
    const row2 = active.map((f) => f.sample2);

    const escapeCell = (cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, row1, row2].map((r) => r.map(escapeCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crm_lite_customized_leads_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    showToast('Customized CSV template downloaded!', 'success');
  };

  const renderAddCrmFieldCard = () => (
    <div className="add-crm-field-box">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={16} color="var(--primary)" />
          <strong style={{ fontSize: '0.9375rem', color: 'var(--text-main)' }}>Add CRM Field</strong>
        </div>
        <button
          type="button"
          onClick={() => setShowAddFieldModal(false)}
          aria-label="Close"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}
        >
          <X size={16} />
        </button>
      </div>

      <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
        Add a preset or custom CRM field to map CSV columns into and include in downloadable templates.
      </p>

      <div className="add-crm-field-grid">
        <div>
          <label className="form-label" style={{ fontSize: '0.78125rem', marginBottom: '0.25rem' }}>
            Field Preset
          </label>
          <select
            className="form-control"
            style={{ fontSize: '0.8125rem', padding: '0.375rem 0.5rem' }}
            value={newFieldPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
          >
            {CRM_FIELD_PRESETS.map((p) => (
              <option key={p.preset} value={p.preset}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label form-label-required" style={{ fontSize: '0.78125rem', marginBottom: '0.25rem' }}>
            CRM Field Name
          </label>
          <input
            type="text"
            className="form-control"
            style={{ fontSize: '0.8125rem', padding: '0.375rem 0.5rem' }}
            placeholder="e.g. Job Title, Industry, Product"
            value={newFieldLabel}
            onChange={(e) => setNewFieldLabel(e.target.value)}
          />
        </div>

        <div>
          <label className="form-label" style={{ fontSize: '0.78125rem', marginBottom: '0.25rem' }}>
            Column Header in CSV
          </label>
          <input
            type="text"
            className="form-control"
            style={{ fontSize: '0.8125rem', padding: '0.375rem 0.5rem' }}
            placeholder="Header title in CSV"
            value={newFieldHeader}
            onChange={(e) => setNewFieldHeader(e.target.value)}
          />
        </div>

        <div>
          <label className="form-label" style={{ fontSize: '0.78125rem', marginBottom: '0.25rem' }}>
            Sample Value
          </label>
          <input
            type="text"
            className="form-control"
            style={{ fontSize: '0.8125rem', padding: '0.375rem 0.5rem' }}
            placeholder="e.g. Sample data"
            value={newFieldSample}
            onChange={(e) => setNewFieldSample(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: '0.8125rem', padding: '0.3125rem 0.75rem' }}
          onClick={() => setShowAddFieldModal(false)}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          style={{ fontSize: '0.8125rem', padding: '0.3125rem 0.875rem' }}
          onClick={handleAddCrmField}
          disabled={!newFieldLabel.trim()}
        >
          <Plus size={13} />
          <span>Add CRM Field</span>
        </button>
      </div>
    </div>
  );

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast('Please select a valid CSV file to import.', 'warning');
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const options = {
        columnMapping,
        defaultStage: defaultImportStage || undefined,
        defaultPriority: defaultImportPriority || undefined,
      };
      const res = await leadApi.importLeads(selectedFile, options);
      const data = res.data || { imported: 0, skipped: 0, total: 0, errors: [] };
      setImportResult(data);
      showToast(
        res.message || `Imported ${data.imported || 0} lead(s).`,
        data.skipped ? 'warning' : 'success'
      );
      fetchLeads();
      fetchKpis();
      if (!data.skipped && data.imported > 0) {
        setTimeout(() => {
          setImportModalOpen(false);
          setSelectedFile(null);
          setCsvHeaders([]);
          setCsvPreviewRows([]);
          setColumnMapping({});
        }, 1500);
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'CSV import failed'), 'error');
    } finally {
      setImporting(false);
    }
  };

  // Dynamic KPI numbers with realistic defaults
  const kpiData = kpis?.kpis || {};
  const statusCharts = kpis?.charts?.by_status || [];
  const priorityCharts = kpis?.charts?.by_priority || [];

  const totalLeadsCount = kpiData.total_leads ?? totalCount ?? leads.length;
  // `lead.status` is serialized as the stage *name*; normalize via the stage slug.
  const leadStageKey = (l) => normalizeStageKey(l.stage_details?.slug || l.status);
  const newLeadsCount = kpiData.new_leads ?? leads.filter((l) => leadStageKey(l) === 'NEW').length;
  const qualifiedLeadsCount = kpiData.qualified_leads ?? leads.filter((l) => leadStageKey(l) === 'QUALIFIED').length;
  const highPriorityCount =
    priorityCharts.find((p) => p.priority === 'HIGH')?.count ??
    leads.filter((l) => l.priority === 'HIGH').length;
  const conversionRate = kpiData.conversion_rate ?? 0;

  // Pipeline stage counts
  const getStageCount = (stageKey) => {
    const found = statusCharts.find((s) => s.status === stageKey);
    if (found) return found.count;
    return leads.filter((l) => leadStageKey(l) === stageKey).length;
  };

  const pipelineStages = [
    { key: 'NEW', label: 'New', count: getStageCount('NEW'), sub: 'Inbound intake' },
    { key: 'CONTACTED', label: 'Contacted', count: getStageCount('CONTACTED'), sub: 'Initial call/chat' },
    { key: 'QUALIFIED', label: 'Qualified', count: getStageCount('QUALIFIED'), sub: 'Needs verified' },
    { key: 'NEGOTIATION', label: 'Proposal', count: getStageCount('NEGOTIATION'), sub: 'Pricing review' },
    { key: 'WON', label: 'Converted', count: getStageCount('WON'), sub: 'Customer created' },
  ];

  const getActivityIcon = (action) => {
    if (action.includes('CONVERT')) return <CheckCircle2 size={14} color="#10b981" />;
    if (action.includes('CREATE')) return <UserPlus size={14} color="#06b6d4" />;
    if (action.includes('STATUS')) return <TrendingUp size={14} color="#3b82f6" />;
    if (action.includes('FOLLOW_UP')) return <Clock size={14} color="#f59e0b" />;
    return <Activity size={14} color="var(--primary)" />;
  };

  return (
    <div className="leads-page">
      {/* 1. Page Header with Title & Quick Actions Toolbar */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Users size={26} />
            <span>Lead Management</span>
          </h1>
          <p className="page-subtitle">
            Manage your prospecting database, track sales pipeline velocity, and stay ahead of follow-ups
          </p>
        </div>

        {/* 5. Quick Actions Toolbar */}
        <div className="quick-actions-toolbar">
          <Link to="/leads/create" className="btn btn-primary" title="Create a new prospective lead">
            <Plus size={17} />
            <span>Create New Lead</span>
          </Link>

          <button
            type="button"
            className="btn-quick-action"
            onClick={() => setScheduleModalOpen(true)}
            title="Schedule an interaction task"
          >
            <CalendarPlus size={15} />
            <span>Schedule Follow-up</span>
          </button>

          <button
            type="button"
            className="btn-quick-action"
            onClick={() => setImportModalOpen(true)}
            title="Import leads from CSV spreadsheet"
          >
            <UploadCloud size={15} />
            <span>Import Leads</span>
          </button>

          <Link to="/pipeline" className="btn-quick-action" title="View visual Kanban board">
            <Kanban size={15} />
            <span>View Pipeline</span>
          </Link>

          <button
            type="button"
            className="btn-quick-action"
            onClick={handleExportLeads}
            disabled={exporting}
            title="Download CSV export"
          >
            <Download size={15} />
            <span>{exporting ? 'Exporting...' : 'Export Leads'}</span>
          </button>
        </div>
      </div>

      {/* 1. LEAD SUMMARY CARDS STRIP */}
      <div className="leads-summary-grid">
        {/* Total Leads */}
        <div className="lead-summary-card summary-card-accent-emerald">
          <div className="summary-card-header">
            <span className="summary-card-label">Total Leads</span>
            <div className="summary-card-icon-wrap" style={{ color: '#10b981' }}>
              <Users size={16} />
            </div>
          </div>
          <div className="summary-card-value">{totalLeadsCount}</div>
          <div className="summary-card-sub">
            <span style={{ color: '#10b981', fontWeight: 600 }}>Active Database</span>
            <span>• All sources</span>
          </div>
        </div>

        {/* New Leads */}
        <div className="lead-summary-card summary-card-accent-cyan">
          <div className="summary-card-header">
            <span className="summary-card-label">New Prospects</span>
            <div className="summary-card-icon-wrap" style={{ color: '#06b6d4' }}>
              <Sparkles size={16} />
            </div>
          </div>
          <div className="summary-card-value">{newLeadsCount}</div>
          <div className="summary-card-sub">
            <span style={{ color: '#06b6d4', fontWeight: 600 }}>Fresh Leads</span>
            <span>• Awaiting outreach</span>
          </div>
        </div>

        {/* Qualified Leads */}
        <div className="lead-summary-card summary-card-accent-blue">
          <div className="summary-card-header">
            <span className="summary-card-label">Qualified</span>
            <div className="summary-card-icon-wrap" style={{ color: '#3b82f6' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="summary-card-value">{qualifiedLeadsCount}</div>
          <div className="summary-card-sub">
            <span style={{ color: '#3b82f6', fontWeight: 600 }}>Sales Ready</span>
            <span>• Conversion-eligible</span>
          </div>
        </div>

        {/* High Priority Leads */}
        <div className="lead-summary-card summary-card-accent-amber">
          <div className="summary-card-header">
            <span className="summary-card-label">High Priority</span>
            <div className="summary-card-icon-wrap" style={{ color: '#f59e0b' }}>
              <Flame size={16} />
            </div>
          </div>
          <div className="summary-card-value">{highPriorityCount}</div>
          <div className="summary-card-sub">
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>Urgent Focus</span>
            <span>• Immediate response</span>
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="lead-summary-card summary-card-accent-purple">
          <div className="summary-card-header">
            <span className="summary-card-label">Conversion Rate</span>
            <div className="summary-card-icon-wrap" style={{ color: '#8b5cf6' }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="summary-card-value">{conversionRate}%</div>
          <div className="summary-card-sub">
            <span style={{ color: '#8b5cf6', fontWeight: 600 }}>Win Velocity</span>
            <span>• Lead-to-customer</span>
          </div>
        </div>
      </div>

      {/* 4. LEAD PIPELINE MINI OVERVIEW */}
      <div className="mini-pipeline-container">
        <div className="mini-pipeline-header">
          <div className="mini-pipeline-title">
            <Kanban size={15} color="var(--primary)" />
            <span>Sales Pipeline Velocity (Click to filter table)</span>
          </div>
          {statusFilter && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setStatusFilter('');
                setCurrentPage(1);
              }}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
            >
              Clear Filter ({statusFilter.replace('_', ' ')}) ✕
            </button>
          )}
        </div>

        <div className="mini-pipeline-track">
          {pipelineStages.map((stg, idx) => (
            <React.Fragment key={stg.key}>
              <button
                type="button"
                className={`mini-pipeline-step ${statusFilter === stg.key ? 'active' : ''}`}
                onClick={() => handleStageClick(stg.key)}
                title={`Filter table to show only ${stg.label} leads`}
                aria-pressed={statusFilter === stg.key}
              >
                <div className="mini-step-info">
                  <span className="mini-step-name">{stg.label}</span>
                  <span className="mini-step-sub">{stg.sub}</span>
                </div>
                <span className="mini-step-count">{stg.count}</span>
              </button>
              {idx < pipelineStages.length - 1 && (
                <ChevronRight size={18} className="mini-pipeline-arrow" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-toolbar">
        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder="Search by name, phone, email, or company..."
        />

        <div className="filter-group">
          <div className="contact-item">
            <Filter size={15} className="text-dim" />
            <select
              className="filter-select"
              value={statusFilter}
              onChange={handleStatusChange}
              aria-label="Filter by Lead Stage"
            >
              <option value="">All Stages</option>
              {stages.length > 0 ? (
                stages.map((st) => (
                  <option key={st.id} value={normalizeStageKey(st.slug || st.name)}>
                    {st.name}
                  </option>
                ))
              ) : (
                Object.entries(LEAD_STATUS).map(([key, val]) => (
                  <option key={key} value={val}>
                    {val.replace('_', ' ')}
                  </option>
                ))
              )}
            </select>
          </div>

          <select
            className="filter-select"
            value={priorityFilter}
            onChange={handlePriorityChange}
            aria-label="Filter by Priority"
          >
            <option value="">All Priorities</option>
            {Object.entries(LEAD_PRIORITY).map(([key, val]) => (
              <option key={key} value={val}>
                {val}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={icpStatusFilter}
            onChange={handleIcpStatusChange}
            aria-label="Filter by ICP Status"
          >
            <option value="">All ICP Status</option>
            {Object.entries(ICP_STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.label}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={pldStatusFilter}
            onChange={handlePldStatusChange}
            aria-label="Filter by PLD Status"
          >
            <option value="">All PLD Status</option>
            {Object.entries(PLD_STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.label}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={productFilter}
            onChange={(e) => {
              setProductFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by Product"
          >
            <option value="">All Products</option>
            {availableProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={sourceFilter}
            onChange={handleSourceChange}
            aria-label="Filter by Source"
          >
            <option value="">All Sources</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {canHandoverLeads && (
            <select
              className="filter-select"
              value={assignedToFilter}
              onChange={handleAssignedToChange}
              aria-label="Filter by Assigned Executive"
            >
              <option value="">All Executives</option>
              {executives.map((exec) => (
                <option key={exec.id} value={exec.id}>
                  {exec.full_name || exec.email}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Primary Leads Table */}
      {canHandoverLeads && selectedLeads.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            padding: '0.625rem 1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '0.875rem' }}>
            {selectedLeads.length} lead{selectedLeads.length > 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedLeads([])}
            >
              Deselect All
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setBulkModalOpen(true)}
            >
              <Share2 size={14} />
              <span>Handover Selected ({selectedLeads.length})</span>
            </button>
          </div>
        </div>
      )}
      <div className="table-responsive">
        {loading ? (
          <LoadingSpinner text="Retrieving leads..." />
        ) : leads.length === 0 ? (
          <EmptyState
            title="No leads found"
            message="No leads match your current search and filter criteria."
            actionLabel="Create First Lead"
            onAction={() => navigate('/leads/create')}
          />
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                {canHandoverLeads && (
                  <th style={{ width: '38px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      ref={selectAllRef}
                      checked={leads.length > 0 && selectedLeads.length === leads.length}
                      onChange={handleToggleSelectAll}
                      aria-label="Select all leads"
                    />
                  </th>
                )}
                <th>Lead / Company</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Priority</th>
                <th>ICP</th>
                <th>PLD</th>
                <th>Assigned To</th>
                <th>Expected Value</th>
                <th>Created</th>
                <th className="table-action-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  {canHandoverLeads && (
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={() => handleToggleSelect(lead.id)}
                        aria-label={`Select lead ${lead.name}`}
                      />
                    </td>
                  )}
                  <td className="table-truncate-cell">
                    <div className="lead-name-cell">
                      <Link to={`/leads/${lead.id}`} className="lead-primary-name">
                        {lead.name}
                      </Link>
                      <span className="lead-company-name">
                        {lead.company_name ? lead.company_name : 'Individual / No Company'}
                      </span>
                      {lead.products && lead.products.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '3px' }}>
                          {lead.products.slice(0, 2).map((p) => (
                            <span
                              key={p.id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                fontSize: '0.67rem',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                color: 'var(--primary)',
                                border: '1px solid rgba(99, 102, 241, 0.25)',
                                maxWidth: '120px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={`${p.name} (${p.code}) - ${formatCurrency(p.unit_price)}`}
                            >
                              <Package size={9} />
                              {p.name}
                            </span>
                          ))}
                          {lead.products.length > 2 && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                padding: '1px 4px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--bg-card-subtle)',
                                color: 'var(--text-dim)',
                              }}
                              title={lead.products.slice(2).map((p) => p.name).join(', ')}
                            >
                              +{lead.products.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="table-truncate-cell">
                    <div className="lead-contact-cell">
                      <span className="contact-item">
                        <Phone size={13} className="text-dim" /> {lead.phone}
                      </span>
                      {lead.email && (
                        <span className="contact-item">
                          <Mail size={13} className="text-dim" /> {lead.email}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={lead.stage_details || lead.status} />
                    {lead.stage_task_summary && (
                      <div style={{ marginTop: '3px' }}>
                        <Link
                          to={`/leads/${lead.id}?tab=stage-tasks`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '0.67rem',
                            padding: '1px 5px',
                            borderRadius: '9999px',
                            textDecoration: 'none',
                            fontWeight: 600,
                            backgroundColor: lead.stage_task_summary.can_progress ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                            color: lead.stage_task_summary.can_progress ? '#10b981' : '#f59e0b',
                            border: `1px solid ${lead.stage_task_summary.can_progress ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                          }}
                          title="Click to view stage tasks"
                        >
                          <CheckSquare size={10} />
                          <span>{lead.stage_task_summary.completed_mandatory_tasks}/{lead.stage_task_summary.mandatory_tasks} Tasks</span>
                        </Link>
                      </div>
                    )}
                  </td>
                  <td>
                    <PriorityBadge priority={lead.priority} />
                  </td>
                  <td>
                    <IcpStatusBadge status={lead.icp_status} size="sm" />
                  </td>
                  <td>
                    {lead.pld_status && lead.pld_status !== PLD_STATUS.NOT_ASSESSED && (
                      <span className="pld-score-chip" style={{ marginRight: '0.35rem' }}>
                        {lead.pld_score ?? 0}
                      </span>
                    )}
                    <PldStatusBadge status={lead.pld_status} size="sm" />
                  </td>
                  <td>
                    <span className="text-main font-semibold font-sm">
                      {lead.assigned_to_details?.full_name ||
                        lead.assigned_to_details?.email ||
                        'Unassigned'}
                    </span>
                  </td>
                  <td>
                    <span className="lead-value-cell">
                      {formatCurrency(lead.expected_value)}
                    </span>
                  </td>
                  <td>
                    <span className="text-dim font-sm">
                      {formatDate(lead.created_at)}
                    </span>
                  </td>
                  <td className="table-action-col">
                    <div className="action-buttons-group" style={{ justifyContent: 'flex-end' }}>
                      <Link
                        to={`/leads/${lead.id}?tab=stage-tasks`}
                        className="icon-action-btn"
                        title="View Stage Tasks"
                        aria-label={`View stage tasks for ${lead.name}`}
                      >
                        <CheckSquare size={15} />
                      </Link>
                      <button
                        type="button"
                        className="icon-action-btn"
                        title="Schedule Follow-up"
                        aria-label={`Schedule follow-up for ${lead.name}`}
                        onClick={() => handleOpenScheduleForLead(lead)}
                      >
                        <CalendarPlus size={15} />
                      </button>
                      <Link
                        to={`/leads/${lead.id}`}
                        className="icon-action-btn"
                        title="View Lead Details"
                        aria-label={`View details for ${lead.name}`}
                      >
                        <Eye size={15} />
                      </Link>
                      <Link
                        to={`/leads/${lead.id}/edit`}
                        className="icon-action-btn"
                        title="Edit Lead"
                        aria-label={`Edit ${lead.name}`}
                      >
                        <Edit size={15} />
                      </Link>
                      {canDeleteLeads && (
                        <button
                          type="button"
                          className="icon-action-btn icon-action-btn-danger"
                          title="Delete Lead (Admin Only)"
                          aria-label={`Delete ${lead.name}`}
                          onClick={() => handleOpenDelete(lead)}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && (
          <Pagination
            currentPage={currentPage}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={(page) => setCurrentPage(page)}
          />
        )}
      </div>

      {/* 2 & 3. 2-COLUMN BOTTOM GRID (Upcoming Follow-ups + Recent Activity) */}
      <div className="leads-bottom-grid">
        {/* 2. Upcoming Follow-ups Panel */}
        <div className="leads-panel-card">
          <div className="leads-panel-header">
            <div className="leads-panel-title-group">
              <Clock size={17} color="var(--primary)" />
              <h3 className="leads-panel-title">Upcoming Follow-ups</h3>
            </div>
            <Link to="/follow-ups" className="leads-panel-link">
              <span>View All</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="followup-compact-list">
            {panelsLoading ? (
              <LoadingSpinner size={22} text="Loading follow-ups..." />
            ) : followups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
                No upcoming follow-ups scheduled
              </div>
            ) : (
              followups.slice(0, 4).map((fu) => (
                <div key={fu.id} className="followup-compact-item">
                  <div className="followup-compact-lead">
                    <Link to={`/leads/${fu.lead}`} className="followup-lead-name">
                      {fu.lead_name || 'Prospect Contact'}
                    </Link>
                    <span className="followup-lead-company">
                      {fu.lead_company || 'Corporate Prospect'}
                    </span>
                  </div>

                  <div className="followup-compact-meta">
                    <span className="followup-purpose-tag">{fu.purpose}</span>
                    <div className="followup-time-pill">
                      <Calendar size={12} color="var(--text-dim)" />
                      <span>{formatDateTime(fu.follow_up_at)}</span>
                    </div>
                    {fu.is_overdue && (
                      <span className="status-badge" style={{ color: 'var(--danger)', backgroundColor: 'rgba(239, 68, 68, 0.12)', fontSize: '0.6875rem' }}>
                        Overdue
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. Recent Activity Panel */}
        <div className="leads-panel-card">
          <div className="leads-panel-header">
            <div className="leads-panel-title-group">
              <Activity size={17} color="var(--primary)" />
              <h3 className="leads-panel-title">Recent Activity</h3>
            </div>
            <span className="text-dim font-sm" style={{ fontSize: '0.75rem' }}>Live Audit Feed</span>
          </div>

          <div className="activity-compact-list">
            {panelsLoading ? (
              <LoadingSpinner size={22} text="Loading activity..." />
            ) : activities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
                No recent activity recorded
              </div>
            ) : (
              activities.slice(0, 4).map((act) => (
                <div key={act.id} className="activity-compact-item">
                  <div className="activity-compact-icon">
                    {getActivityIcon(act.action)}
                  </div>
                  <div className="activity-compact-content">
                    <p className="activity-compact-text">{act.notes}</p>
                    <div className="activity-compact-meta">
                      <span>{formatDateTime(act.created_at)}</span>
                      {act.performer_name && (
                        <>
                          <span>•</span>
                          <span style={{ color: 'var(--primary-light)', fontWeight: 600 }}>
                            {act.performer_name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal: Quick Schedule Follow-up */}
      {scheduleModalOpen && (
        <div className="modal-backdrop" onClick={() => setScheduleModalOpen(false)}>
          <div className="modal-container" ref={scheduleDialogRef} role="dialog" aria-modal="true" aria-label="Schedule follow-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <CalendarPlus size={18} color="var(--primary)" />
                <h3>Quick Schedule Follow-up</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setScheduleModalOpen(false)} aria-label="Close dialog">✕</button>
            </div>
            <form onSubmit={handleQuickScheduleSubmit}>
              <div className="modal-body form-layout">
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="quick-fu-lead">
                    Target Lead
                  </label>
                  <select
                    id="quick-fu-lead"
                    className="form-control"
                    value={newFollowup.lead}
                    onChange={(e) => setNewFollowup({ ...newFollowup, lead: e.target.value })}
                    required
                  >
                    <option value="">Select a Lead from Database</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.company_name || 'Individual'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="quick-fu-purpose">Interaction Purpose</label>
                  <select
                    id="quick-fu-purpose"
                    className="form-control"
                    value={newFollowup.purpose}
                    onChange={(e) => setNewFollowup({ ...newFollowup, purpose: e.target.value })}
                  >
                    {FOLLOWUP_PURPOSES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="quick-fu-datetime">
                    Scheduled Date & Time
                  </label>
                  <input
                    id="quick-fu-datetime"
                    type="datetime-local"
                    className="form-control"
                    value={newFollowup.follow_up_at}
                    min={toLocalDateTimeInput(new Date())}
                    onChange={(e) => setNewFollowup({ ...newFollowup, follow_up_at: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setScheduleModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={scheduling}>
                  {scheduling ? 'Scheduling...' : 'Schedule Follow-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Import Leads CSV & Custom Template Builder */}
      {importModalOpen && (
        <div className="modal-backdrop" onClick={() => setImportModalOpen(false)}>
          <div
            className="modal-container import-modal-container"
            ref={importDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Import leads from CSV and customize template"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <FileSpreadsheet size={20} color="var(--primary)" />
                <div>
                  <h3 style={{ margin: 0 }}>Import Leads & Custom CSV Template</h3>
                  <span className="text-dim font-sm">
                    Upload any CSV, customize column mapping, or build a matching template
                  </span>
                </div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setImportModalOpen(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            {/* Segmented Mode Switcher */}
            <div style={{ padding: '0.75rem 1.5rem 0', backgroundColor: 'var(--bg-surface)' }}>
              <div className="import-mode-switch">
                <button
                  type="button"
                  className={`import-mode-btn ${importActiveTab === 'upload' ? 'active' : ''}`}
                  onClick={() => setImportActiveTab('upload')}
                >
                  <UploadCloud size={16} />
                  <span>Upload & Map CSV {selectedFile ? `(${selectedFile.name})` : ''}</span>
                </button>
                <button
                  type="button"
                  className={`import-mode-btn ${importActiveTab === 'builder' ? 'active' : ''}`}
                  onClick={() => setImportActiveTab('builder')}
                >
                  <SlidersHorizontal size={16} />
                  <span>Customize CSV Template Builder</span>
                </button>
              </div>
            </div>

            {importActiveTab === 'upload' ? (
              <form onSubmit={handleImportSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div className="import-modal-body">
                  {!selectedFile ? (
                    <>
                      <label
                        htmlFor="csv-file-input"
                        className="import-drop-zone"
                        role="button"
                        tabIndex={0}
                        aria-label="Select a CSV file to import"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            document.getElementById('csv-file-input').click();
                          }
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (e.dataTransfer.files?.[0]) handleImportFile(e.dataTransfer.files[0]);
                        }}
                      >
                        <FileSpreadsheet size={40} className="import-drop-icon" />
                        <div>
                          <strong className="text-main" style={{ display: 'block', fontSize: '1rem', marginBottom: '0.25rem' }}>
                            Click to browse or drag & drop any CSV spreadsheet
                          </strong>
                          <span className="text-dim font-sm">
                            Any column format supported. You can customize column mapping and preview data before importing. (Max 10MB)
                          </span>
                        </div>
                        <input
                          id="csv-file-input"
                          type="file"
                          accept=".csv"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            handleImportFile(e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.25rem' }}>
                        <div
                          className="import-template-download"
                          role="button"
                          tabIndex={0}
                          aria-label="Download standard sample CSV template"
                          onClick={handleDownloadTemplate}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleDownloadTemplate();
                            }
                          }}
                        >
                          <Download size={14} />
                          <span>Download Standard Sample Template</span>
                        </div>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
                          onClick={() => setImportActiveTab('builder')}
                        >
                          <SlidersHorizontal size={14} />
                          <span>Build Custom CSV Template</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Active File Banner */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          background: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <FileSpreadsheet size={24} color="var(--primary)" />
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9375rem' }}>
                              {selectedFile.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                              {(selectedFile.size / 1024).toFixed(1)} KB • {csvTotalRows} data rows detected • {csvHeaders.length} columns found
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <label
                            htmlFor="csv-file-input-reupload"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.78125rem', padding: '0.3125rem 0.625rem', cursor: 'pointer', margin: 0 }}
                          >
                            Change File
                            <input
                              id="csv-file-input-reupload"
                              type="file"
                              accept=".csv"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                handleImportFile(e.target.files?.[0]);
                                e.target.value = '';
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.78125rem', padding: '0.3125rem 0.625rem', color: 'var(--danger)' }}
                            onClick={() => {
                              setSelectedFile(null);
                              setCsvHeaders([]);
                              setCsvPreviewRows([]);
                              setColumnMapping({});
                              setImportResult(null);
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Matching Template Download & Mapping Actions Banner */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.75rem',
                          padding: '0.75rem 1rem',
                          backgroundColor: 'rgba(34, 197, 94, 0.08)',
                          border: '1px solid rgba(34, 197, 94, 0.25)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.84375rem' }}>
                            Need this exact format for future uploads?
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            Download a blank CSV template matching your file's columns and mapping.
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.78125rem', padding: '0.375rem 0.75rem' }}
                            onClick={() => setShowAddFieldModal(!showAddFieldModal)}
                          >
                            <Plus size={13} />
                            <span>Add CRM Field</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.78125rem', padding: '0.375rem 0.75rem' }}
                            onClick={handleResetMapping}
                            title="Re-run auto heuristic detection for columns"
                          >
                            <RefreshCw size={13} />
                            <span>Reset Auto-Mapping</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ fontSize: '0.78125rem', padding: '0.375rem 0.75rem' }}
                            onClick={handleDownloadMatchingTemplate}
                          >
                            <Download size={13} />
                            <span>Download Template Matching This CSV</span>
                          </button>
                        </div>
                      </div>

                      {showAddFieldModal && renderAddCrmFieldCard()}

                      {/* Interactive Column Mapping Card */}
                      <div className="import-card">
                        <div className="import-card-header">
                          <div className="import-card-title">
                            <SlidersHorizontal size={16} color="var(--primary)" />
                            <span>Customize Column Mapping</span>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.125rem 0.5rem',
                                borderRadius: '12px',
                                backgroundColor: 'var(--primary-subtle)',
                                color: 'var(--primary)',
                                fontWeight: 600,
                              }}
                            >
                              {Object.values(columnMapping).filter((v) => v && v !== 'skip').length} of {csvHeaders.length} columns imported
                            </span>
                          </div>
                          <span style={{ fontSize: '0.78125rem', color: 'var(--text-dim)' }}>
                            Map each column to its CRM field or choose "Skip" to ignore.
                          </span>
                        </div>

                        <div className="import-mapping-grid">
                          {csvHeaders.map((header) => {
                            const currentTarget = columnMapping[header] || 'skip';
                            const isSkipped = currentTarget === 'skip';
                            const sampleValue = csvPreviewRows[0]?.[header];

                            return (
                              <div
                                key={header}
                                className={`import-mapping-row ${isSkipped ? 'skipped' : ''}`}
                              >
                                <div className="import-source-col">
                                  <span className="import-source-name" title={header}>
                                    {header}
                                  </span>
                                  <span className="import-source-sample" title={sampleValue || 'Empty'}>
                                    Sample: {sampleValue ? `"${sampleValue}"` : '(blank)'}
                                  </span>
                                </div>

                                <div className="import-mapping-arrow">→</div>

                                <div>
                                  <select
                                    className="import-target-select"
                                    value={currentTarget}
                                    onChange={(e) => handleColumnMapChange(header, e.target.value)}
                                    aria-label={`Map CSV header ${header} to CRM field`}
                                  >
                                    {availableCrmFields.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Default Fallback Settings */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                          gap: '0.75rem',
                          padding: '0.75rem 1rem',
                          background: 'var(--bg-surface-elevated)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <div>
                          <label className="form-label" style={{ fontSize: '0.78125rem', marginBottom: '0.25rem' }}>
                            Default Stage (Fallback)
                          </label>
                          <select
                            className="form-control"
                            style={{ fontSize: '0.8125rem', padding: '0.375rem 0.625rem' }}
                            value={defaultImportStage}
                            onChange={(e) => setDefaultImportStage(e.target.value)}
                          >
                            <option value="">Auto / CSV specified</option>
                            {stages.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="form-label" style={{ fontSize: '0.78125rem', marginBottom: '0.25rem' }}>
                            Default Priority (Fallback)
                          </label>
                          <select
                            className="form-control"
                            style={{ fontSize: '0.8125rem', padding: '0.375rem 0.625rem' }}
                            value={defaultImportPriority}
                            onChange={(e) => setDefaultImportPriority(e.target.value)}
                          >
                            <option value="">MEDIUM (Default)</option>
                            <option value="LOW">LOW</option>
                            <option value="MEDIUM">MEDIUM</option>
                            <option value="HIGH">HIGH</option>
                            <option value="URGENT">URGENT</option>
                          </select>
                        </div>
                      </div>

                      {/* Live Data Preview */}
                      {csvPreviewRows.length > 0 && (
                        <div className="import-card">
                          <div className="import-card-header" style={{ marginBottom: '0.5rem' }}>
                            <div className="import-card-title">
                              <Table size={16} color="var(--primary)" />
                              <span>Live Preview ({csvPreviewRows.length} sample rows)</span>
                            </div>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                              onClick={() => setShowPreviewTable(!showPreviewTable)}
                            >
                              {showPreviewTable ? 'Collapse Preview' : 'Show Preview'}
                            </button>
                          </div>

                          {showPreviewTable && (
                            <div className="import-preview-wrapper">
                              <table className="import-preview-table">
                                <thead>
                                  <tr>
                                    {csvHeaders.map((header) => {
                                      const target = columnMapping[header] || 'skip';
                                      const isSkip = target === 'skip';
                                      return (
                                        <th key={header} style={{ opacity: isSkip ? 0.5 : 1 }}>
                                          <div style={{ fontSize: '0.75rem', color: isSkip ? 'var(--text-dim)' : 'var(--primary)' }}>
                                            {isSkip ? '🚫 Skip' : `→ ${target}`}
                                          </div>
                                          <div>{header}</div>
                                        </th>
                                      );
                                    })}
                                  </tr>
                                </thead>
                                <tbody>
                                  {csvPreviewRows.map((row, idx) => (
                                    <tr key={idx}>
                                      {csvHeaders.map((header) => {
                                        const isSkip = (columnMapping[header] || 'skip') === 'skip';
                                        return (
                                          <td
                                            key={header}
                                            style={{
                                              opacity: isSkip ? 0.45 : 1,
                                              textDecoration: isSkip ? 'line-through' : 'none',
                                            }}
                                          >
                                            {row[header] || '—'}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Import Result / Error Warnings */}
                      {importResult && (
                        <div
                          role="status"
                          style={{
                            padding: '0.875rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--bg-surface-elevated)',
                            border: `1px solid ${importResult.skipped > 0 ? 'var(--warning)' : 'var(--success)'}`,
                            fontSize: '0.875rem',
                            color: 'var(--text-main)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                            <CheckCircle2 size={16} color={importResult.skipped > 0 ? 'var(--warning)' : 'var(--success)'} />
                            <span>
                              Imported {importResult.imported} of {importResult.total} lead(s).
                              {importResult.skipped > 0 && ` (${importResult.skipped} row(s) skipped)`}
                            </span>
                          </div>
                          {importResult.errors?.length > 0 && (
                            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', color: 'var(--danger)', fontSize: '0.8125rem' }}>
                              {importResult.errors.map((rowErr, i) => (
                                <li key={`${rowErr.row}-${i}`}>
                                  Row {rowErr.row}: {rowErr.message}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '1rem 1.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setImportModalOpen(false);
                      setSelectedFile(null);
                      setCsvHeaders([]);
                      setCsvPreviewRows([]);
                      setColumnMapping({});
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={importing || !selectedFile}
                  >
                    {importing ? (
                      <>
                        <RefreshCw size={14} className="spinning" />
                        <span>Processing & Importing...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={14} />
                        <span>Upload & Import Leads</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Custom CSV Template Builder View */
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div className="import-modal-body">
                  <div
                    style={{
                      padding: '0.875rem 1rem',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
                      Tailor Your Leads CSV Template
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
                      Select which fields you want in the spreadsheet, edit column header titles to match your existing files, and download a ready-to-fill template.
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: '0.78125rem', padding: '0.3125rem 0.625rem' }}
                        onClick={() => handleSelectAllTemplateFields(true)}
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: '0.78125rem', padding: '0.3125rem 0.625rem' }}
                        onClick={() => handleSelectAllTemplateFields(false)}
                      >
                        Deselect All
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ fontSize: '0.78125rem', padding: '0.3125rem 0.75rem' }}
                        onClick={() => setShowAddFieldModal(!showAddFieldModal)}
                      >
                        <Plus size={13} />
                        <span>Add CRM Field</span>
                      </button>
                    </div>

                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
                      {templateFields.filter((f) => f.enabled).length} of {templateFields.length} fields active
                    </span>
                  </div>

                  {showAddFieldModal && renderAddCrmFieldCard()}

                  <div className="import-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '28px 1.1fr 1.2fr 1fr 36px',
                        gap: '0.75rem',
                        padding: '0.625rem 0.875rem',
                        backgroundColor: 'var(--bg-surface)',
                        borderBottom: '1px solid var(--border-subtle)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--text-dim)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <div></div>
                      <div>CRM Field</div>
                      <div>Custom Header in CSV</div>
                      <div>Sample Value</div>
                      <div></div>
                    </div>

                    {templateFields.map((f) => (
                      <div key={f.key} className="import-template-builder-row">
                        <input
                          type="checkbox"
                          checked={f.enabled}
                          onChange={() => handleToggleTemplateField(f.key)}
                          id={`tpl-field-${f.key}`}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                        <label
                          htmlFor={`tpl-field-${f.key}`}
                          style={{
                            fontSize: '0.84375rem',
                            fontWeight: 600,
                            color: f.enabled ? 'var(--text-main)' : 'var(--text-dim)',
                            cursor: 'pointer',
                            margin: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                          }}
                        >
                          <span>{f.label}</span>
                          {f.isCustom && (
                            <span
                              style={{
                                fontSize: '0.6875rem',
                                padding: '0.0625rem 0.375rem',
                                borderRadius: '4px',
                                backgroundColor: 'var(--primary-subtle)',
                                color: 'var(--primary)',
                                fontWeight: 700,
                              }}
                            >
                              Custom
                            </span>
                          )}
                        </label>
                        <div>
                          <input
                            type="text"
                            className="form-control"
                            style={{
                              fontSize: '0.8125rem',
                              padding: '0.3125rem 0.5rem',
                              height: '32px',
                              opacity: f.enabled ? 1 : 0.5,
                            }}
                            value={f.customHeader}
                            disabled={!f.enabled}
                            onChange={(e) => handleUpdateTemplateHeader(f.key, e.target.value)}
                            placeholder="Header title in CSV"
                          />
                        </div>
                        <div
                          style={{
                            fontSize: '0.78125rem',
                            color: 'var(--text-dim)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          "{f.sample}"
                        </div>
                        <div>
                          {f.isCustom ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomField(f.key)}
                              title={`Remove custom field ${f.label}`}
                              style={{
                                color: 'var(--danger)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0.25rem',
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          ) : (
                            <div style={{ width: '20px' }}></div>
                          )}
                        </div>
                      </div>
                    ))}

                    <div style={{ padding: '0.625rem 0.875rem', backgroundColor: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)' }}>
                      <button
                        type="button"
                        onClick={() => setShowAddFieldModal(true)}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px dashed var(--border-strong)',
                          background: 'transparent',
                          color: 'var(--primary)',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.375rem',
                        }}
                      >
                        <Plus size={14} />
                        <span>Add Another CRM Field to Template</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '1rem 1.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setImportActiveTab('upload')}
                  >
                    Back to Upload
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleDownloadCustomBuilderTemplate}
                    disabled={templateFields.filter((f) => f.enabled).length === 0}
                  >
                    <Download size={14} />
                    <span>Download Tailored CSV Template</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Bulk Handover Leads */}
      {bulkModalOpen && (
        <div className="modal-backdrop" onClick={() => setBulkModalOpen(false)}>
          <div className="modal-container" ref={bulkDialogRef} role="dialog" aria-modal="true" aria-label="Bulk handover leads" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div className="modal-title-row">
                <Share2 size={18} color="var(--primary)" />
                <h3>Bulk Handover Leads</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setBulkModalOpen(false)} aria-label="Close dialog">✕</button>
            </div>
            <form onSubmit={handleConfirmBulkHandover}>
              <div className="modal-body form-layout">
                <p className="text-muted font-sm">
                  Transferring <strong>{selectedLeads.length}</strong> selected lead(s) to a new Sales Executive.
                </p>
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="bulk-exec-target">Transfer To</label>
                  <select
                    id="bulk-exec-target"
                    className="form-control"
                    value={bulkTarget}
                    onChange={(e) => setBulkTarget(e.target.value)}
                    required
                  >
                    <option value="">Select Sales Executive</option>
                    {executives.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="bulk-handover-reason">Reason</label>
                  <textarea
                    id="bulk-handover-reason"
                    className="form-control"
                    rows={3}
                    placeholder="e.g. John is on leave, regional portfolio reallocation..."
                    value={bulkReason}
                    onChange={(e) => setBulkReason(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setBulkModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={bulkSubmitting || !bulkTarget || !bulkReason.trim()}
                >
                  <Share2 size={14} />
                  <span>{bulkSubmitting ? 'Transferring...' : 'Confirm Bulk Handover'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Lead Record"
        message={`Are you sure you want to permanently delete lead "${leadToDelete?.name}"? All associated notes and follow-ups will also be removed.`}
        confirmText="Delete Lead"
        isDestructive={true}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setLeadToDelete(null);
        }}
      />
    </div>
  );
};
