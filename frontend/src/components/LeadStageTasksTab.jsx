import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  CheckCircle2,
  Clock,
  User,
  Calendar,
  Plus,
  ArrowRight,
  Filter,
  RefreshCw,
  Trash2,
  Lock,
  Check,
  X,
  Loader2,
  Search,
  Eye,
  LayoutList,
  LayoutGrid,
  AlertCircle,
  ArrowUpDown,
  Tag,
  Share2,
} from 'lucide-react';
import { leadApi } from '../api/leadApi';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/formatters';
import '../styles/stage_tasks.css';

export default function LeadStageTasksTab({
  lead,
  stages = [],
  users = [],
  onLeadUpdated,
  onAdvanceStageClick,
}) {
  const { showToast } = useToast();
  const { user: currentUser, isManagerOrAdmin } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  // Seeing Options States:
  const [filterType, setFilterType] = useState('ALL'); // ALL, MANDATORY, OPTIONAL, INCOMPLETE, COMPLETED, OVERDUE, MY_TASKS
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('ORDER'); // ORDER, PRIORITY, DUE_DATE, STATUS
  const [viewMode, setViewMode] = useState('DETAILED'); // DETAILED | COMPACT
  const [selectedStageId, setSelectedStageId] = useState(lead?.stage?.id || lead?.stage || '');

  // Task Inspector / View Details Modal State:
  const [inspectedTask, setInspectedTask] = useState(null);

  // Add Task Modal State:
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    purpose: 'Phone Call',
    due_date: '',
    assigned_to: lead?.assigned_to?.id || lead?.assigned_to || '',
    is_mandatory: true,
  });
  const [savingTask, setSavingTask] = useState(false);

  // Outcome notes / Complete modal state:
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [showOutcomeDialog, setShowOutcomeDialog] = useState(false);
  const [activeTaskForNotes, setActiveTaskForNotes] = useState(null);

  // Reassign state:
  const [reassigningTaskId, setReassigningTaskId] = useState(null);
  const [newAssigneeId, setNewAssigneeId] = useState('');

  // Advancing stage state:
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    if (lead?.id) {
      loadTasks();
    }
  }, [lead?.id, lead?.stage?.id, selectedStageId]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const params = selectedStageId ? { stage: selectedStageId } : {};
      const res = await leadApi.getLeadStageTasks(lead.id, params);
      setTasks(res.data?.tasks || []);
      setSummary(res.data?.summary || lead?.stage_task_summary || null);
    } catch (err) {
      console.error('Failed to load lead stage tasks:', err);
      showToast('Failed to load stage tasks.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (task) => {
    if (task.status !== 'COMPLETED') {
      // Opening outcome notes dialog for completion
      setActiveTaskForNotes(task);
      setOutcomeNotes('');
      setShowOutcomeDialog(true);
    } else {
      // Reopen task
      try {
        setCompletingTaskId(task.id);
        await leadApi.toggleCompleteStageTask(task.id);
        showToast(`Task '${task.title}' reopened.`, 'info');
        if (inspectedTask && inspectedTask.id === task.id) {
          setInspectedTask((prev) => (prev ? { ...prev, status: 'PENDING', completed_at: null, completed_by_name: null } : null));
        }
        await loadTasks();
        if (onLeadUpdated) onLeadUpdated();
      } catch (err) {
        showToast(err.response?.data?.message || 'Failed to reopen task.', 'error');
      } finally {
        setCompletingTaskId(null);
      }
    }
  };

  const handleConfirmComplete = async () => {
    if (!activeTaskForNotes) return;
    setCompletingTaskId(activeTaskForNotes.id);
    try {
      await leadApi.toggleCompleteStageTask(activeTaskForNotes.id, outcomeNotes);
      showToast(`Task '${activeTaskForNotes.title}' marked as completed!`, 'success');
      if (inspectedTask && inspectedTask.id === activeTaskForNotes.id) {
        setInspectedTask((prev) =>
          prev
            ? {
                ...prev,
                status: 'COMPLETED',
                outcome_notes: outcomeNotes,
                completed_at: new Date().toISOString(),
                completed_by_name: currentUser?.first_name || 'Staff',
              }
            : null
        );
      }
      setShowOutcomeDialog(false);
      setActiveTaskForNotes(null);
      await loadTasks();
      if (onLeadUpdated) onLeadUpdated();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to complete task.', 'error');
    } finally {
      setCompletingTaskId(null);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskData.title.trim()) {
      showToast('Task title is required.', 'error');
      return;
    }
    setSavingTask(true);
    try {
      await leadApi.createLeadStageTask(lead.id, {
        ...newTaskData,
        stage: selectedStageId || lead.stage?.id || lead.stage,
      });
      showToast('Custom stage task added successfully!', 'success');
      setIsAddModalOpen(false);
      setNewTaskData({
        title: '',
        description: '',
        priority: 'MEDIUM',
        purpose: 'Phone Call',
        due_date: '',
        assigned_to: lead?.assigned_to?.id || lead?.assigned_to || '',
        is_mandatory: true,
      });
      await loadTasks();
      if (onLeadUpdated) onLeadUpdated();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add stage task.', 'error');
    } finally {
      setSavingTask(false);
    }
  };

  const handleReassign = async (taskId, assigneeId) => {
    if (!assigneeId) return;
    try {
      await leadApi.reassignStageTask(taskId, assigneeId);
      showToast('Task reassigned successfully.', 'success');
      setReassigningTaskId(null);
      if (inspectedTask && inspectedTask.id === taskId) {
        const found = users.find((u) => u.id === Number(assigneeId));
        setInspectedTask((prev) => (prev ? { ...prev, assigned_to_id: assigneeId, assigned_to_name: found ? `${found.first_name} ${found.last_name}` : 'Assigned' } : null));
      }
      await loadTasks();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to reassign task.', 'error');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this stage task?')) return;
    try {
      await leadApi.deleteLeadStageTask(taskId);
      showToast('Stage task deleted.', 'info');
      if (inspectedTask && inspectedTask.id === taskId) {
        setInspectedTask(null);
      }
      await loadTasks();
      if (onLeadUpdated) onLeadUpdated();
    } catch (err) {
      showToast('Failed to delete stage task.', 'error');
    }
  };

  // Find current and next stage in pipeline order
  const currentStageObj =
    stages.find((s) => s.id === (lead.stage?.id || lead.stage)) || lead.stage;
  const sortedStages = [...stages].sort(
    (a, b) => (a.order || a.display_order || 0) - (b.order || b.display_order || 0)
  );
  const currentStageIdx = sortedStages.findIndex((s) => s.id === currentStageObj?.id);
  const nextStageObj =
    currentStageIdx >= 0 && currentStageIdx < sortedStages.length - 1
      ? sortedStages[currentStageIdx + 1]
      : null;

  const handleAdvanceNextStage = async () => {
    if (!nextStageObj) return;
    if (onAdvanceStageClick) {
      onAdvanceStageClick(nextStageObj);
      return;
    }
    setAdvancing(true);
    try {
      await leadApi.updateLead(lead.id, { stage: nextStageObj.id });
      showToast(`Lead successfully advanced to stage '${nextStageObj.name}'!`, 'success');
      if (onLeadUpdated) onLeadUpdated();
      await loadTasks();
    } catch (err) {
      showToast(
        err.response?.data?.message || 'Cannot advance stage: check mandatory tasks.',
        'error'
      );
    } finally {
      setAdvancing(false);
    }
  };

  // Dynamic Seeing Counts
  const now = new Date();
  const counts = {
    ALL: tasks.length,
    MANDATORY: tasks.filter((t) => t.is_mandatory).length,
    OPTIONAL: tasks.filter((t) => !t.is_mandatory).length,
    INCOMPLETE: tasks.filter((t) => t.status !== 'COMPLETED').length,
    COMPLETED: tasks.filter((t) => t.status === 'COMPLETED').length,
    OVERDUE: tasks.filter((t) => t.status !== 'COMPLETED' && t.due_date && new Date(t.due_date) < now).length,
    MY_TASKS: tasks.filter((t) => currentUser && t.assigned_to_id === currentUser.id).length,
  };

  // Filter tasks based on seeing options
  const filteredTasks = tasks.filter((t) => {
    // 1. Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title?.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      const matchPurpose = t.purpose?.toLowerCase().includes(q);
      const matchAssignee = t.assigned_to_name?.toLowerCase().includes(q);
      const matchStage = t.stage_name?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchPurpose && !matchAssignee && !matchStage) {
        return false;
      }
    }

    // 2. Status / Category Filter
    if (filterType === 'MANDATORY') return t.is_mandatory;
    if (filterType === 'OPTIONAL') return !t.is_mandatory;
    if (filterType === 'INCOMPLETE') return t.status !== 'COMPLETED';
    if (filterType === 'COMPLETED') return t.status === 'COMPLETED';
    if (filterType === 'OVERDUE') return t.status !== 'COMPLETED' && t.due_date && new Date(t.due_date) < now;
    if (filterType === 'MY_TASKS') return currentUser && t.assigned_to_id === currentUser.id;
    return true;
  });

  // Sort tasks based on selected seeing sort
  const priorityOrder = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === 'PRIORITY') {
      const pA = priorityOrder[(a.priority || '').toUpperCase()] || 0;
      const pB = priorityOrder[(b.priority || '').toUpperCase()] || 0;
      return pB - pA;
    }
    if (sortBy === 'DUE_DATE') {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    }
    if (sortBy === 'STATUS') {
      if (a.status === b.status) return 0;
      return a.status === 'COMPLETED' ? 1 : -1;
    }
    // Default: Order in stage
    return (a.order || 0) - (b.order || 0);
  });

  const mandatoryTasks = tasks.filter((t) => t.is_mandatory);
  const completedMandatory = mandatoryTasks.filter((t) => t.status === 'COMPLETED');
  const canAdvance =
    summary?.can_progress ??
    (mandatoryTasks.length === 0 || completedMandatory.length === mandatoryTasks.length);
  const progressPercent =
    summary?.completion_percentage ??
    (mandatoryTasks.length
      ? Math.round((completedMandatory.length / mandatoryTasks.length) * 100)
      : 100);

  const priorityClass = (p) => {
    const val = (p || '').toUpperCase();
    if (val === 'URGENT') return 'urgent';
    if (val === 'HIGH') return 'high';
    if (val === 'LOW') return 'low';
    return 'medium';
  };

  return (
    <div className="lead-stage-tasks-tab">
      {/* 1. TOP PROGRESSION READINESS CARD */}
      <div className="stage-progress-card">
        <div className="stage-progress-main">
          <div className="stage-progress-left">
            <div className="stage-progress-tags">
              <span
                className="stage-color-pill"
                style={{ backgroundColor: currentStageObj?.color || '#059669' }}
              >
                {currentStageObj?.name || 'Current Stage'}
              </span>

              <span className={`stage-status-badge ${canAdvance ? 'ready' : 'pending'}`}>
                {canAdvance ? (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Ready for Next Stage</span>
                  </>
                ) : (
                  <>
                    <Clock size={14} />
                    <span>
                      Tasks In Progress ({mandatoryTasks.length - completedMandatory.length} Pending)
                    </span>
                  </>
                )}
              </span>

              {currentStageObj?.require_manager_approval && (
                <span className="stage-approval-lock">
                  <Lock size={12} />
                  <span>Requires Manager Approval</span>
                </span>
              )}
            </div>

            <h3 className="stage-progress-title">
              Stage Task Completion & Progression Status
            </h3>
            <p className="stage-progress-subtitle">
              All mandatory checkpoint tasks in this stage must be completed before the lead can
              advance. Optional tasks provide recommendations but do not block progression.
            </p>
          </div>

          {/* Action button & completion counter */}
          <div className="stage-progress-actions">
            <div className="stage-stat-summary">
              <div className="stage-stat-label">Mandatory Completion</div>
              <div className="stage-stat-count">
                {completedMandatory.length} / {mandatoryTasks.length} ({progressPercent}%)
              </div>
            </div>

            {nextStageObj && (
              <button
                type="button"
                onClick={handleAdvanceNextStage}
                disabled={!canAdvance || advancing}
                className={`btn-advance-stage ${canAdvance ? 'enabled' : 'disabled'}`}
                title={
                  canAdvance
                    ? `Advance lead to ${nextStageObj.name}`
                    : `Complete all mandatory tasks to advance to ${nextStageObj.name}`
                }
              >
                {advancing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Advancing...</span>
                  </>
                ) : (
                  <>
                    <span>Advance to {nextStageObj.name}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="stage-progress-bar-wrap">
          <div
            className={`stage-progress-bar-fill ${canAdvance ? 'ready' : ''}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 2. TASK SEEING OPTIONS TOOLBAR */}
      <div className="stage-tasks-toolbar" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
        {/* Row 1: Primary Filter Pills with Live Task Counters */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div className="filter-pills-group" style={{ flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`filter-pill-btn ${filterType === 'ALL' ? 'active' : ''}`}
            >
              All Tasks <span className="filter-pill-counter">{counts.ALL}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('MANDATORY')}
              className={`filter-pill-btn ${filterType === 'MANDATORY' ? 'active' : ''}`}
            >
              Mandatory <span className="filter-pill-counter">{counts.MANDATORY}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('INCOMPLETE')}
              className={`filter-pill-btn ${filterType === 'INCOMPLETE' ? 'active' : ''}`}
            >
              Pending <span className="filter-pill-counter">{counts.INCOMPLETE}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('COMPLETED')}
              className={`filter-pill-btn ${filterType === 'COMPLETED' ? 'active' : ''}`}
            >
              Completed <span className="filter-pill-counter">{counts.COMPLETED}</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('OPTIONAL')}
              className={`filter-pill-btn ${filterType === 'OPTIONAL' ? 'active' : ''}`}
            >
              Optional <span className="filter-pill-counter">{counts.OPTIONAL}</span>
            </button>
            {counts.OVERDUE > 0 && (
              <button
                type="button"
                onClick={() => setFilterType('OVERDUE')}
                className={`filter-pill-btn ${filterType === 'OVERDUE' ? 'active' : ''}`}
                style={{ color: filterType === 'OVERDUE' ? 'var(--danger)' : undefined }}
              >
                ⚠️ Overdue <span className="filter-pill-counter" style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)' }}>{counts.OVERDUE}</span>
              </button>
            )}
            {currentUser && counts.MY_TASKS > 0 && (
              <button
                type="button"
                onClick={() => setFilterType('MY_TASKS')}
                className={`filter-pill-btn ${filterType === 'MY_TASKS' ? 'active' : ''}`}
              >
                👤 My Tasks <span className="filter-pill-counter">{counts.MY_TASKS}</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={loadTasks}
              className="btn-toolbar-icon"
              title="Refresh Tasks"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="btn-add-stage-task"
            >
              <Plus size={15} />
              <span>Add Stage Task</span>
            </button>
          </div>
        </div>

        {/* Row 2: Search, Stage Filter, Sort By & View Mode Toggle */}
        <div className="task-seeing-toolbar-row">
          {/* Search Box */}
          <div className="task-search-box">
            <Search size={14} className="text-dim" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks by title, description, assignee..."
              className="task-search-input"
              aria-label="Search stage tasks"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Seeing Controls: Stage filter, Sort selector, View Mode */}
          <div className="task-seeing-controls-right">
            {/* Stage selector */}
            <div className="stage-filter-label">
              <Filter size={13} />
              <select
                value={selectedStageId}
                onChange={(e) => setSelectedStageId(e.target.value)}
                className="task-sort-select"
                aria-label="Filter tasks by stage"
              >
                <option value="">All Stages</option>
                {stages.map((stg) => (
                  <option key={stg.id} value={stg.id}>
                    {stg.name} {stg.id === (lead.stage?.id || lead.stage) ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ArrowUpDown size={13} className="text-dim" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="task-sort-select"
                aria-label="Sort tasks"
              >
                <option value="ORDER">Sort: Stage Order</option>
                <option value="PRIORITY">Sort: Priority (Urgent first)</option>
                <option value="DUE_DATE">Sort: Due Date (Earliest first)</option>
                <option value="STATUS">Sort: Status (Pending first)</option>
              </select>
            </div>

            {/* View Mode Toggle (Detailed Cards vs Compact Rows) */}
            <div className="view-mode-toggle-group" title="Toggle task seeing format">
              <button
                type="button"
                onClick={() => setViewMode('DETAILED')}
                className={`view-mode-toggle-btn ${viewMode === 'DETAILED' ? 'active' : ''}`}
                title="Detailed Cards View"
                aria-label="Detailed Cards View"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('COMPACT')}
                className={`view-mode-toggle-btn ${viewMode === 'COMPACT' ? 'active' : ''}`}
                title="Compact List View"
                aria-label="Compact List View"
              >
                <LayoutList size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. TASKS DISPLAY LIST */}
      {loading ? (
        <div className="stage-tasks-empty">
          <Loader2 size={24} className="animate-spin text-primary" />
          <p className="stage-tasks-empty-desc">Loading stage tasks...</p>
        </div>
      ) : sortedTasks.length === 0 ? (
        <div className="stage-tasks-empty">
          <CheckSquare size={36} className="stage-tasks-empty-icon" />
          <h4 className="stage-tasks-empty-title">No Stage Tasks Found</h4>
          <p className="stage-tasks-empty-desc">
            {searchQuery
              ? `No tasks match "${searchQuery}". Try clearing your search.`
              : filterType !== 'ALL'
              ? 'Try switching your filter to view all stage tasks.'
              : 'There are no tasks assigned for this stage yet. Click "Add Stage Task" to create one.'}
          </p>
        </div>
      ) : viewMode === 'COMPACT' ? (
        /* COMPACT ROWS VIEW */
        <div className="stage-tasks-compact-list">
          {sortedTasks.map((task) => {
            const isCompleted = task.status === 'COMPLETED';
            const isBlocked = task.is_blocked_by_dependency;
            const isOverdue = task.is_overdue || (task.due_date && !isCompleted && new Date(task.due_date) < now);

            return (
              <div
                key={task.id}
                className={`stage-task-row-compact ${isCompleted ? 'completed' : task.is_mandatory ? 'mandatory' : ''}`}
              >
                <div className="compact-left">
                  <button
                    type="button"
                    disabled={completingTaskId === task.id || isBlocked}
                    onClick={() => handleToggleComplete(task)}
                    className={`task-check-circle ${isCompleted ? 'checked' : ''} ${isBlocked ? 'blocked' : ''}`}
                    style={{ width: '20px', height: '20px' }}
                    title={
                      isBlocked
                        ? `Blocked by prerequisite: ${task.dependency_title || 'Prerequisite task'}`
                        : isCompleted
                        ? 'Click to reopen task'
                        : 'Click to mark completed'
                    }
                  >
                    {completingTaskId === task.id ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : isCompleted ? (
                      <Check size={12} />
                    ) : isBlocked ? (
                      <Lock size={10} />
                    ) : null}
                  </button>

                  <span
                    className={`compact-title ${isCompleted ? 'strikethrough' : ''}`}
                    onClick={() => setInspectedTask(task)}
                    title="Click to view full task details"
                  >
                    {task.title}
                  </span>

                  {task.is_mandatory ? (
                    <span className="badge-checkpoint" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                      Mandatory
                    </span>
                  ) : (
                    <span className="badge-optional" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                      Optional
                    </span>
                  )}

                  <span className={`badge-priority ${priorityClass(task.priority)}`} style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                    {task.priority || 'Medium'}
                  </span>

                  {task.stage_name && (
                    <span className="badge-stage-tag" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
                      {task.stage_name}
                    </span>
                  )}
                </div>

                <div className="compact-right">
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <User size={12} /> {task.assigned_to_name || 'Unassigned'}
                  </span>

                  {task.due_date && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: isOverdue ? 'var(--danger)' : 'var(--text-dim)',
                        fontWeight: isOverdue ? 700 : 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <Calendar size={12} /> {new Date(task.due_date).toLocaleDateString()}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setInspectedTask(task)}
                    className="btn-inspect-task"
                    title="View task details"
                  >
                    <Eye size={12} /> View
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* DETAILED CARDS VIEW */
        <div className="stage-tasks-list">
          {sortedTasks.map((task) => {
            const isCompleted = task.status === 'COMPLETED';
            const isBlocked = task.is_blocked_by_dependency;
            const isOverdue = task.is_overdue || (task.due_date && !isCompleted && new Date(task.due_date) < now);

            return (
              <div
                key={task.id}
                className={`stage-task-card ${
                  isCompleted ? 'completed' : task.is_mandatory ? 'mandatory' : ''
                }`}
              >
                <div className="task-card-left">
                  {/* Completion Checkbox */}
                  <button
                    type="button"
                    disabled={completingTaskId === task.id || isBlocked}
                    onClick={() => handleToggleComplete(task)}
                    className={`task-check-circle ${isCompleted ? 'checked' : ''} ${
                      isBlocked ? 'blocked' : ''
                    }`}
                    title={
                      isBlocked
                        ? `Blocked by prerequisite: ${task.dependency_title || 'Prerequisite task'}`
                        : isCompleted
                        ? 'Click to reopen task'
                        : 'Click to mark completed'
                    }
                  >
                    {completingTaskId === task.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : isCompleted ? (
                      <Check size={14} />
                    ) : isBlocked ? (
                      <Lock size={12} />
                    ) : null}
                  </button>

                  <div className="task-card-content">
                    <div className="task-title-row">
                      <h4
                        className={`task-card-title ${isCompleted ? 'strikethrough' : ''}`}
                        onClick={() => setInspectedTask(task)}
                        style={{ cursor: 'pointer' }}
                        title="Click to view full task details"
                      >
                        {task.title}
                      </h4>

                      {task.is_mandatory ? (
                        <span className="badge-checkpoint">Mandatory Checkpoint</span>
                      ) : (
                        <span className="badge-optional">Optional</span>
                      )}

                      <span className={`badge-priority ${priorityClass(task.priority)}`}>
                        {task.priority || 'Medium'}
                      </span>

                      <span className="badge-channel">{task.purpose || 'Task'}</span>

                      {task.stage_name && (
                        <span className="badge-stage-tag">{task.stage_name}</span>
                      )}

                      {isOverdue && (
                        <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', fontWeight: 700 }}>
                          ⚠️ Overdue
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className="task-card-desc">{task.description}</p>
                    )}

                    {/* Prerequisite warning */}
                    {isBlocked && (
                      <div className="task-dependency-warning">
                        <Lock size={13} />
                        <span>
                          Prerequisite task must be completed first:{' '}
                          <strong>{task.dependency_title || 'Prerequisite'}</strong>
                        </span>
                      </div>
                    )}

                    {/* Meta row */}
                    <div className="task-card-meta">
                      {/* Assignee */}
                      <div className="task-meta-item">
                        <User size={13} />
                        <span>Assignee:</span>
                        {reassigningTaskId === task.id ? (
                          <div className="reassign-inline-form">
                            <select
                              value={newAssigneeId}
                              onChange={(e) => setNewAssigneeId(e.target.value)}
                              className="reassign-select"
                            >
                              <option value="">Select User...</option>
                              {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.first_name} {u.last_name} ({u.role})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleReassign(task.id, newAssigneeId)}
                              className="btn btn-primary btn-sm"
                              style={{ padding: '0.15rem 0.5rem', fontSize: '0.72rem' }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setReassigningTaskId(null)}
                              className="btn btn-sm"
                              style={{ padding: '0.15rem 0.35rem' }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontWeight: 600 }}>
                            {task.assigned_to_name || 'Unassigned'}
                          </span>
                        )}

                        {!isCompleted && isManagerOrAdmin && reassigningTaskId !== task.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setReassigningTaskId(task.id);
                              setNewAssigneeId(task.assigned_to_id || '');
                            }}
                            className="btn-reassign-link"
                          >
                            Reassign
                          </button>
                        )}
                      </div>

                      {/* Due date */}
                      {task.due_date && (
                        <div
                          className={`task-meta-item ${
                            isOverdue && !isCompleted ? 'overdue' : ''
                          }`}
                        >
                          <Calendar size={13} />
                          <span>
                            Due: {new Date(task.due_date).toLocaleDateString()}
                            {isOverdue && !isCompleted && ' (Overdue)'}
                          </span>
                        </div>
                      )}

                      {/* Completed Audit */}
                      {isCompleted && (
                        <div className="task-meta-item completed-audit">
                          <CheckCircle2 size={13} />
                          <span>
                            Completed by {task.completed_by_name || 'Staff'} on{' '}
                            {formatDateTime(task.completed_at)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Outcome notes preview */}
                    {isCompleted && task.outcome_notes && (
                      <div className="task-outcome-notes">
                        <strong>Outcome Notes:</strong> {task.outcome_notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => setInspectedTask(task)}
                    className="btn-inspect-task"
                    title="View task details and audit trail"
                  >
                    <Eye size={13} />
                    <span>View Details</span>
                  </button>

                  {!task.rule && isManagerOrAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(task.id)}
                      className="btn-delete-task"
                      title="Delete task"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. MODAL: TASK INSPECTION & FULL DETAILS MODAL */}
      {inspectedTask && (
        <div
          className="modal-backdrop"
          onClick={() => setInspectedTask(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-container modal-container-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <div
                  className="modal-icon-badge"
                  style={{
                    backgroundColor: inspectedTask.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                    color: inspectedTask.status === 'COMPLETED' ? 'var(--success)' : 'var(--primary)',
                    padding: '0.4rem',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Eye size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>
                    {inspectedTask.title}
                  </h3>
                  <p className="text-dim font-xs" style={{ margin: '2px 0 0 0' }}>
                    Stage: {inspectedTask.stage_name || currentStageObj?.name} • {inspectedTask.purpose || 'Task'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setInspectedTask(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Badges strip */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                {inspectedTask.is_mandatory ? (
                  <span className="badge-checkpoint">Mandatory Checkpoint</span>
                ) : (
                  <span className="badge-optional">Optional Recommendation</span>
                )}

                <span className={`badge-priority ${priorityClass(inspectedTask.priority)}`}>
                  {inspectedTask.priority || 'Medium'} Priority
                </span>

                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '9999px',
                    fontWeight: 600,
                    backgroundColor: inspectedTask.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                    color: inspectedTask.status === 'COMPLETED' ? 'var(--success)' : 'var(--warning)',
                  }}
                >
                  {inspectedTask.status === 'COMPLETED' ? '✓ Completed' : '⏳ Action Required'}
                </span>
              </div>

              {/* Description */}
              {inspectedTask.description && (
                <div style={{ background: 'var(--bg-card-subtle)', padding: '0.875rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div className="task-inspect-label">Task Instructions & Description</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {inspectedTask.description}
                  </div>
                </div>
              )}

              {/* Metadata Grid */}
              <div className="task-inspect-grid">
                <div className="task-inspect-field">
                  <div className="task-inspect-label">Assignee</div>
                  <div className="task-inspect-value" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <User size={14} className="text-primary" />
                    <span>{inspectedTask.assigned_to_name || 'Unassigned'}</span>
                  </div>
                </div>

                <div className="task-inspect-field">
                  <div className="task-inspect-label">Due Date</div>
                  <div className="task-inspect-value" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Calendar size={14} className="text-dim" />
                    <span>{inspectedTask.due_date ? new Date(inspectedTask.due_date).toLocaleDateString() : 'No due date set'}</span>
                  </div>
                </div>

                <div className="task-inspect-field">
                  <div className="task-inspect-label">Channel / Purpose</div>
                  <div className="task-inspect-value">{inspectedTask.purpose || 'General Task'}</div>
                </div>

                <div className="task-inspect-field">
                  <div className="task-inspect-label">Progression Impact</div>
                  <div className="task-inspect-value" style={{ color: inspectedTask.is_mandatory ? 'var(--warning)' : 'var(--text-dim)' }}>
                    {inspectedTask.is_mandatory ? 'Blocks stage advance if pending' : 'Does not block advancement'}
                  </div>
                </div>
              </div>

              {/* Prerequisite warning if blocked */}
              {inspectedTask.is_blocked_by_dependency && (
                <div className="task-dependency-warning" style={{ margin: 0 }}>
                  <Lock size={15} />
                  <span>
                    Prerequisite task must be completed first:{' '}
                    <strong>{inspectedTask.dependency_title || 'Prerequisite task'}</strong>
                  </span>
                </div>
              )}

              {/* Completion Outcome Notes if completed */}
              {inspectedTask.status === 'COMPLETED' && (
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '0.875rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span className="task-inspect-label" style={{ color: 'var(--success)' }}>
                      Completion Audit
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      Completed by {inspectedTask.completed_by_name || 'Staff'} on {formatDateTime(inspectedTask.completed_at)}
                    </span>
                  </div>
                  {inspectedTask.outcome_notes ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '0.25rem' }}>
                      <strong>Outcome Notes:</strong> {inspectedTask.outcome_notes}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                      No outcome notes logged.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ justifyContent: 'space-between', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-card-subtle)' }}>
              <div>
                {inspectedTask.status === 'COMPLETED' ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleToggleComplete(inspectedTask)}
                  >
                    Reopen Task
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={inspectedTask.is_blocked_by_dependency}
                    onClick={() => handleToggleComplete(inspectedTask)}
                  >
                    <Check size={14} style={{ marginRight: '4px' }} /> Mark as Completed
                  </button>
                )}
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setInspectedTask(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: ADD CUSTOM STAGE TASK */}
      {isAddModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => !savingTask && setIsAddModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-container modal-container-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <div
                  className="modal-icon-badge"
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    color: 'var(--primary)',
                    padding: '0.4rem',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Plus size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>
                    Add Custom Stage Task
                  </h3>
                  <p className="text-dim font-xs" style={{ margin: '2px 0 0 0' }}>
                    Stage: {stages.find((s) => s.id === (selectedStageId || lead.stage?.id || lead.stage))?.name || 'Current'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAddModalOpen(false)}
                disabled={savingTask}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label className="input-label" htmlFor="new-task-title">
                  Task Title *
                </label>
                <input
                  id="new-task-title"
                  type="text"
                  className="input-field"
                  placeholder="e.g. Schedule Executive Demo with VP of Sales"
                  value={newTaskData.title}
                  onChange={(e) => setNewTaskData({ ...newTaskData, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="input-label" htmlFor="new-task-desc">
                  Description / Action Items
                </label>
                <textarea
                  id="new-task-desc"
                  className="input-field"
                  rows={2}
                  placeholder="Details of what needs to be verified or accomplished..."
                  value={newTaskData.description}
                  onChange={(e) => setNewTaskData({ ...newTaskData, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="input-label" htmlFor="new-task-priority">
                    Priority
                  </label>
                  <select
                    id="new-task-priority"
                    className="input-field"
                    value={newTaskData.priority}
                    onChange={(e) => setNewTaskData({ ...newTaskData, priority: e.target.value })}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="input-label" htmlFor="new-task-purpose">
                    Channel / Purpose
                  </label>
                  <select
                    id="new-task-purpose"
                    className="input-field"
                    value={newTaskData.purpose}
                    onChange={(e) => setNewTaskData({ ...newTaskData, purpose: e.target.value })}
                  >
                    <option value="Phone Call">Phone Call</option>
                    <option value="Demo">Demo</option>
                    <option value="Follow-up Call">Follow-up Call</option>
                    <option value="Email">Email</option>
                    <option value="Review">Document Review</option>
                    <option value="General Task">General Task</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="input-label" htmlFor="new-task-assignee">
                    Assigned To
                  </label>
                  <select
                    id="new-task-assignee"
                    className="input-field"
                    value={newTaskData.assigned_to}
                    onChange={(e) => setNewTaskData({ ...newTaskData, assigned_to: e.target.value })}
                  >
                    <option value="">Select Assignee...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="input-label" htmlFor="new-task-due">
                    Due Date
                  </label>
                  <input
                    id="new-task-due"
                    type="date"
                    className="input-field"
                    value={newTaskData.due_date}
                    onChange={(e) => setNewTaskData({ ...newTaskData, due_date: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <input
                  id="new-task-mandatory"
                  type="checkbox"
                  checked={newTaskData.is_mandatory}
                  onChange={(e) => setNewTaskData({ ...newTaskData, is_mandatory: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="new-task-mandatory" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
                  Mandatory Checkpoint (Required to advance stage)
                </label>
              </div>

              <div className="modal-actions" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={savingTask}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingTask}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  {savingTask ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: OUTCOME NOTES ON COMPLETION */}
      {showOutcomeDialog && activeTaskForNotes && (
        <div
          className="modal-backdrop"
          onClick={() => !completingTaskId && setShowOutcomeDialog(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-container modal-container-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <div
                  className="modal-icon-badge"
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--success)',
                    padding: '0.4rem',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>
                    Mark Task Completed
                  </h3>
                  <p className="text-dim font-xs" style={{ margin: '2px 0 0 0' }}>
                    {activeTaskForNotes.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowOutcomeDialog(false)}
                disabled={Boolean(completingTaskId)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <p className="text-dim font-sm" style={{ margin: 0 }}>
                Please provide any brief outcome notes, customer responses, or audit observations from completing this stage checkpoint.
              </p>

              <div>
                <label className="input-label" htmlFor="outcome-notes-input">
                  Outcome Notes (Optional)
                </label>
                <textarea
                  id="outcome-notes-input"
                  className="input-field"
                  rows={3}
                  placeholder="e.g. Conducted 45-min demo with VP; decision makers confirmed budget approval."
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                />
              </div>

              <div className="modal-actions" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowOutcomeDialog(false)}
                  disabled={Boolean(completingTaskId)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirmComplete}
                  disabled={Boolean(completingTaskId)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  {completingTaskId ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  Confirm Completion
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
