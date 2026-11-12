import React, { useState, useEffect } from 'react';
import { targetApi } from '../api/targetApi';
import { formatCurrency } from '../utils/formatters';
import {
  Target,
  PhoneCall,
  UserPlus,
  Briefcase,
  IndianRupee,
  CheckCircle2,
  Clock,
  Sparkles,
  Flame,
  Info,
} from 'lucide-react';

export const MyTargetWidget = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMyTarget();
  }, []);

  const loadMyTarget = async () => {
    try {
      const res = await targetApi.getCurrentTarget();
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err) {
      // Silent error fallback, widget simply doesn't block dashboard
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) return null;

  const { daily = {}, monthly = {}, notes, period_month } = data;
  const dCalls = daily.calls || { target: 10, actual: 0, percentage: 0, remaining: 10, achieved: false };
  const dLeads = daily.leads || { target: 3, actual: 0, percentage: 0, remaining: 3, achieved: false };
  const mDeals = monthly.deals_won || { target: 5, actual: 0, percentage: 0, remaining: 5, achieved: false };
  const mRev = monthly.revenue || { target: 50000, actual: 0, percentage: 0, remaining: 50000, achieved: false };

  // Generate motivating context banner
  const getMotivationalMessage = () => {
    if (dCalls.achieved && mDeals.achieved) {
      return { text: "Outstanding performance! You've crushed both your daily and monthly goals!", icon: Sparkles, color: 'var(--success)' };
    }
    if (dCalls.achieved) {
      return { text: "Daily call goal achieved! You're on fire today! Keep the momentum going.", icon: Flame, color: '#f59e0b' };
    }
    if (dCalls.remaining <= 3 && dCalls.remaining > 0) {
      return { text: `Almost there! Just ${dCalls.remaining} more call${dCalls.remaining > 1 ? 's' : ''} to reach today's target.`, icon: Clock, color: 'var(--primary)' };
    }
    return { text: `Today's objective: Complete ${dCalls.target} calls and engage ${dLeads.target} new leads.`, icon: Target, color: 'var(--primary)' };
  };

  const motivation = getMotivationalMessage();
  const MotivationIcon = motivation.icon;

  return (
    <div
      className="card my-targets-card"
      style={{
        marginBottom: '1.5rem',
        padding: '1.25rem 1.5rem',
        borderRadius: 'var(--radius-lg)',
        border: '1.5px solid var(--border-subtle)',
        background: 'linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-surface-elevated) 100%)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Top Banner Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.15rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(99, 102, 241, 0.2))',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Target size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              My Sales Targets & Daily Goals
              <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                {period_month}
              </span>
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Track daily calls, prospect outreach, and monthly quota milestone pacing
            </p>
          </div>
        </div>

        {/* Motivational Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.85rem',
            borderRadius: 'var(--radius-full)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: motivation.color,
          }}
        >
          <MotivationIcon size={15} />
          <span>{motivation.text}</span>
        </div>
      </div>

      {/* Targets Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        {/* Metric 1: Daily Calls */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <PhoneCall size={14} color="#0284c7" /> Today's Calls
            </span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: dCalls.achieved ? 'var(--success)' : 'var(--text-main)' }}>
              {dCalls.percentage}%
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {dCalls.actual}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              / {dCalls.target} target
            </span>
          </div>

          <div className="bar-track" style={{ height: '8px', borderRadius: '4px' }}>
            <div
              className="bar-fill"
              style={{
                width: `${Math.min(dCalls.percentage, 100)}%`,
                backgroundColor: dCalls.achieved ? 'var(--success)' : '#0284c7',
                borderRadius: '4px',
              }}
            />
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.35rem' }}>
            {dCalls.achieved ? '🎯 Daily call quota completed!' : `${dCalls.remaining} more calls to hit today's target`}
          </div>
        </div>

        {/* Metric 2: Daily Leads */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <UserPlus size={14} color="#10b981" /> Today's Leads Handled
            </span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: dLeads.achieved ? 'var(--success)' : 'var(--text-main)' }}>
              {dLeads.percentage}%
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {dLeads.actual}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              / {dLeads.target} target
            </span>
          </div>

          <div className="bar-track" style={{ height: '8px', borderRadius: '4px' }}>
            <div
              className="bar-fill"
              style={{
                width: `${Math.min(dLeads.percentage, 100)}%`,
                backgroundColor: dLeads.achieved ? 'var(--success)' : '#10b981',
                borderRadius: '4px',
              }}
            />
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.35rem' }}>
            {dLeads.achieved ? '🎯 Daily lead target reached!' : `${dLeads.remaining} more prospects to contact today`}
          </div>
        </div>

        {/* Metric 3: Monthly Deals Won */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Briefcase size={14} color="#8b5cf6" /> Monthly Deals Won
            </span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: mDeals.achieved ? 'var(--success)' : 'var(--text-main)' }}>
              {mDeals.percentage}%
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {mDeals.actual}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              / {mDeals.target} deals
            </span>
          </div>

          <div className="bar-track" style={{ height: '8px', borderRadius: '4px' }}>
            <div
              className="bar-fill"
              style={{
                width: `${Math.min(mDeals.percentage, 100)}%`,
                backgroundColor: mDeals.achieved ? 'var(--success)' : '#8b5cf6',
                borderRadius: '4px',
              }}
            />
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.35rem' }}>
            {mDeals.achieved ? '🏆 Monthly deals goal achieved!' : `${mDeals.remaining} more deals to close this month`}
          </div>
        </div>

        {/* Metric 4: Monthly Revenue Quota */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <IndianRupee size={14} color="#10b981" /> Monthly Quota (₹)
            </span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: mRev.achieved ? 'var(--success)' : 'var(--text-main)' }}>
              {mRev.percentage}%
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {formatCurrency(mRev.actual)}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              / {formatCurrency(mRev.target)}
            </span>
          </div>

          <div className="bar-track" style={{ height: '8px', borderRadius: '4px' }}>
            <div
              className="bar-fill"
              style={{
                width: `${Math.min(mRev.percentage, 100)}%`,
                backgroundColor: mRev.achieved ? 'var(--success)' : '#10b981',
                borderRadius: '4px',
              }}
            />
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.35rem' }}>
            {mRev.achieved ? '🎉 Monthly quota reached!' : `${formatCurrency(mRev.remaining)} remaining to achieve quota`}
          </div>
        </div>
      </div>

      {/* Admin Notes / Directive if provided */}
      {notes && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.625rem 0.875rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8rem',
            color: 'var(--text-main)',
          }}
        >
          <Info size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
          <span>
            <strong>Admin Directive:</strong> {notes}
          </span>
        </div>
      )}
    </div>
  );
};
