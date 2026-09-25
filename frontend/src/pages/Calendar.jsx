import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Calendar as CalendarIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { calendarApi } from '../api/calendarApi';
import { userApi } from '../api/userApi';
import { toLocalDateKey } from '../utils/formatters';
import { FOLLOWUP_PURPOSES } from '../utils/constants';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CalendarEventModal } from '../components/CalendarEventModal';
import { CalendarScheduleModal } from '../components/CalendarScheduleModal';

export const Calendar = () => {
  const { isAdmin, isManager } = useAuth();
  const canFilterUsers = isAdmin || isManager;

  // View state: 'month', 'week', 'day'
  const [currentView, setCurrentView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Filter state
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedPurpose, setSelectedPurpose] = useState('ALL');
  const [teamMembers, setTeamMembers] = useState([]);

  // Events data state
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventsError, setEventsError] = useState(null);

  // Modal states
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [scheduleModalDate, setScheduleModalDate] = useState(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  // Load team members for Admin/Manager
  useEffect(() => {
    if (canFilterUsers) {
      userApi.getUsers().then((res) => {
        const users = res.results || res;
        setTeamMembers(Array.isArray(users) ? users : []);
      }).catch((err) => {
        console.error('Failed to load team members:', err);
      });
    }
  }, [canFilterUsers]);

  // Compute date range for current view
  const { rangeStart, rangeEnd, headerTitle } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (currentView === 'month') {
      // Month start: first day of month minus buffer days
      const firstDay = new Date(year, month, 1);
      const startBuffer = new Date(year, month, 1 - firstDay.getDay());
      // Month end: last day of month plus buffer days to fill 42 cells
      const endBuffer = new Date(year, month, 42 - firstDay.getDay());
      endBuffer.setHours(23, 59, 59, 999);

      return {
        rangeStart: startBuffer.toISOString(),
        rangeEnd: endBuffer.toISOString(),
        headerTitle: currentDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      };
    } else if (currentView === 'week') {
      const dayOfWeek = currentDate.getDay();
      const sunday = new Date(currentDate);
      sunday.setDate(currentDate.getDate() - dayOfWeek);
      sunday.setHours(0, 0, 0, 0);

      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      saturday.setHours(23, 59, 59, 999);

      const title = `${sunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${saturday.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

      return {
        rangeStart: sunday.toISOString(),
        rangeEnd: saturday.toISOString(),
        headerTitle: title
      };
    } else {
      // Day view
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      return {
        rangeStart: dayStart.toISOString(),
        rangeEnd: dayEnd.toISOString(),
        headerTitle: currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
      };
    }
  }, [currentDate, currentView]);

  // Fetch calendar events
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setEventsError(null);
    try {
      const params = {
        start: rangeStart,
        end: rangeEnd,
      };
      if (canFilterUsers && selectedUser) {
        params.assigned_to = selectedUser;
      }
      if (selectedStatus && selectedStatus !== 'ALL') {
        params.status = selectedStatus;
      }
      if (selectedPurpose && selectedPurpose !== 'ALL') {
        params.purpose = selectedPurpose;
      }

      const res = await calendarApi.getEvents(params);
      setEvents(res.results || []);
    } catch (err) {
      console.error('Failed to fetch calendar events:', err);
      setEventsError('Could not load calendar events. Please check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [rangeStart, rangeEnd, canFilterUsers, selectedUser, selectedStatus, selectedPurpose]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Navigation handlers
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (currentView === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else if (currentView === 'week') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setDate(d.getDate() - 1);
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (currentView === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else if (currentView === 'week') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(d.getDate() + 1);
    }
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Group events by date string (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach((ev) => {
      const dateKey = toLocalDateKey(new Date(ev.start));
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(ev);
    });
    return map;
  }, [events]);

  // Quick schedule opener
  const handleCellClick = (dateStr) => {
    setScheduleModalDate(dateStr);
    setIsScheduleOpen(true);
  };

  // Month grid day calculations
  const monthDays = useMemo(() => {
    if (currentView !== 'month') return [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 is Sunday
    const days = [];

    // 42 cells (6 rows x 7 cols)
    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(year, month, 1 - startDayOfWeek + i);
      const dateStr = toLocalDateKey(cellDate);
      const isCurrentMonth = cellDate.getMonth() === month;
      const isToday = cellDate.toDateString() === new Date().toDateString();

      days.push({
        date: cellDate,
        dateStr,
        dayNum: cellDate.getDate(),
        isCurrentMonth,
        isToday,
        events: eventsByDate[dateStr] || []
      });
    }
    return days;
  }, [currentDate, currentView, eventsByDate]);

  // Week days calculation
  const weekDays = useMemo(() => {
    if (currentView !== 'week') return [];
    const dayOfWeek = currentDate.getDay();
    const sunday = new Date(currentDate);
    sunday.setDate(currentDate.getDate() - dayOfWeek);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const dateStr = toLocalDateKey(d);
      days.push({
        date: d,
        dateStr,
        dayName: d.toLocaleDateString(undefined, { weekday: 'short' }),
        dayNum: d.getDate(),
        isToday: d.toDateString() === new Date().toDateString(),
        events: eventsByDate[dateStr] || []
      });
    }
    return days;
  }, [currentDate, currentView, eventsByDate]);

  return (
    <div className="calendar-page-container">
      {/* Page Title */}
      <div className="calendar-header">
        <div className="calendar-title-group">
          <h1>Calendar View</h1>
          <p className="calendar-subtitle">
            Visualize and manage follow-ups, meetings, and calls across your schedule
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          onClick={() => {
            setScheduleModalDate(toLocalDateKey(new Date()));
            setIsScheduleOpen(true);
          }}
        >
          <Plus size={16} />
          <span>Schedule Event</span>
        </button>
      </div>

      {/* Controls & Filter Bar */}
      <div className="calendar-controls-card">
        {/* Navigation & Title */}
        <div className="calendar-nav-group">
          <button
            type="button"
            className="calendar-nav-btn"
            onClick={handlePrev}
            title="Previous"
            aria-label="Previous period"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="calendar-today-btn"
            onClick={handleToday}
            aria-label="Go to today"
          >
            Today
          </button>
          <button
            type="button"
            className="calendar-nav-btn"
            onClick={handleNext}
            title="Next"
            aria-label="Next period"
          >
            <ChevronRight size={18} />
          </button>
          <div className="calendar-current-date-title">{headerTitle}</div>
        </div>

        {/* Filters & View Switcher */}
        <div className="calendar-filters-group">
          {/* User selector for Admin / Manager */}
          {canFilterUsers && (
            <select
              className="calendar-select-filter"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              title="Filter by Team Member"
              aria-label="Filter by team member"
            >
              <option value="">All Team Members</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.first_name ? `${m.first_name} ${m.last_name}` : m.email}
                </option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            className="calendar-select-filter"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            title="Filter by Status"
            aria-label="Filter by status"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Scheduled (Pending)</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Purpose Filter */}
          <select
            className="calendar-select-filter"
            value={selectedPurpose}
            onChange={(e) => setSelectedPurpose(e.target.value)}
            title="Filter by Type"
            aria-label="Filter by event type"
          >
            <option value="ALL">All Event Types</option>
            {FOLLOWUP_PURPOSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div className="calendar-view-toggle" role="tablist" aria-label="Calendar view">
            <button
              type="button"
              role="tab"
              aria-selected={currentView === 'month'}
              className={`calendar-view-btn ${currentView === 'month' ? 'active' : ''}`}
              onClick={() => setCurrentView('month')}
            >
              Month
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={currentView === 'week'}
              className={`calendar-view-btn ${currentView === 'week' ? 'active' : ''}`}
              onClick={() => setCurrentView('week')}
            >
              Week
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={currentView === 'day'}
              className={`calendar-view-btn ${currentView === 'day' ? 'active' : ''}`}
              onClick={() => setCurrentView('day')}
            >
              Day
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid View */}
      {eventsError && !loading && (
        <div
          role="alert"
          className="card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            padding: '1rem 1.25rem',
            marginBottom: '1rem',
            borderColor: 'var(--danger)',
          }}
        >
          <span style={{ color: 'var(--text-main)', fontSize: '0.875rem' }}>{eventsError}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={fetchEvents}>
            Retry
          </button>
        </div>
      )}
      <div className="calendar-board-card">
        {loading ? (
          <LoadingSpinner text="Loading calendar events..." />
        ) : currentView === 'month' ? (
          /* ================= Month View ================= */
          <div className="calendar-month-wrapper">
            <div className="month-grid-header">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="month-grid-header-cell">
                  {d}
                </div>
              ))}
            </div>

            <div className="month-grid-body">
              {monthDays.map((cell, idx) => (
                <div
                  key={idx}
                  className={`month-cell ${!cell.isCurrentMonth ? 'outside-month' : ''} ${cell.isToday ? 'is-today' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${cell.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${cell.events.length > 0 ? `, ${cell.events.length} scheduled event${cell.events.length > 1 ? 's' : ''}` : ''}`}
                  aria-current={cell.isToday ? 'date' : undefined}
                  onClick={() => handleCellClick(cell.dateStr)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCellClick(cell.dateStr);
                    }
                  }}
                >
                  <div className="month-cell-header">
                    <span className="month-date-number">{cell.dayNum}</span>
                    {cell.events.length > 0 && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                        {cell.events.length}
                      </span>
                    )}
                  </div>

                  <div className="month-cell-events">
                    {cell.events.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        className={`calendar-event-chip ${ev.status.toLowerCase()} ${ev.is_overdue ? 'overdue' : ''}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`View event: ${ev.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(ev);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedEvent(ev);
                          }
                        }}
                        title={ev.title}
                      >
                        <span className="calendar-chip-time">
                          {new Date(ev.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                        <span className="calendar-chip-title">{ev.title}</span>
                      </div>
                    ))}
                    {cell.events.length > 3 && (
                      <div
                        className="calendar-more-events"
                        role="button"
                        tabIndex={0}
                        aria-label={`Show all ${cell.events.length} events for this day`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentDate(cell.date);
                          setCurrentView('day');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            setCurrentDate(cell.date);
                            setCurrentView('day');
                          }
                        }}
                      >
                        +{cell.events.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : currentView === 'week' ? (
          /* ================= Week View ================= */
          <div className="week-grid-container">
            {weekDays.map((col, idx) => (
              <div
                key={idx}
                className={`week-column ${col.isToday ? 'is-today' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`${col.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${col.events.length > 0 ? `, ${col.events.length} scheduled event${col.events.length > 1 ? 's' : ''}` : ''}`}
                aria-current={col.isToday ? 'date' : undefined}
                onClick={() => handleCellClick(col.dateStr)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCellClick(col.dateStr);
                  }
                }}
              >
                <div className="week-column-header">
                  <div className="week-column-day-name">{col.dayName}</div>
                  <div className="week-column-day-num">{col.dayNum}</div>
                </div>

                <div className="week-column-events">
                  {col.events.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px 0', fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                      No events
                    </div>
                  ) : (
                    col.events.map((ev) => (
                      <div
                        key={ev.id}
                        className={`calendar-event-chip ${ev.status.toLowerCase()} ${ev.is_overdue ? 'overdue' : ''}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`View event: ${ev.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(ev);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedEvent(ev);
                          }
                        }}
                        style={{ padding: '6px 10px', fontSize: '0.76rem' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
                          <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                            {new Date(ev.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ev.title}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ================= Day View ================= */
          <div className="day-view-container">
            <div className="day-view-header">
              <div className="day-view-date">
                {currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
              <span className="badge badge-primary">{events.length} event(s) scheduled</span>
            </div>

            {events.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-dim)' }}>
                <CalendarIcon size={36} style={{ marginBottom: '8px', opacity: 0.5 }} />
                <p>No events scheduled for this day.</p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginTop: '8px' }}
                  onClick={() => {
                    setScheduleModalDate(toLocalDateKey(currentDate));
                    setIsScheduleOpen(true);
                  }}
                >
                  Schedule Event for Today
                </button>
              </div>
            ) : (
              <div className="day-timeline-list">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="day-event-card"
                    onClick={() => setSelectedEvent(ev)}
                  >
                    <div className="day-event-time">
                      {new Date(ev.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </div>

                    <div className="day-event-details">
                      <div className="day-event-title">{ev.title}</div>
                      <div className="day-event-meta">
                        <span style={{ textTransform: 'capitalize' }}>
                          Type: <strong>{ev.purpose}</strong>
                        </span>
                        {ev.assigned_to && (
                          <span>Assigned: <strong>{ev.assigned_to.full_name}</strong></span>
                        )}
                        <span className={`badge ${ev.status === 'COMPLETED' ? 'badge-success' : ev.is_overdue ? 'badge-danger' : 'badge-primary'}`}>
                          {ev.is_overdue ? 'Overdue' : ev.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Event Details & Action Modal */}
      {selectedEvent && (
        <CalendarEventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onRefresh={fetchEvents}
        />
      )}

      {/* Schedule Event Modal */}
      {isScheduleOpen && (
        <CalendarScheduleModal
          initialDate={scheduleModalDate}
          onClose={() => setIsScheduleOpen(false)}
          onSuccess={fetchEvents}
        />
      )}
    </div>
  );
};
