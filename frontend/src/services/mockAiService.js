/**
 * Mock AI Service for CRM Lite
 * 
 * Provides centralized mock responses for AI Assistant and Call Summarization.
 * Structured cleanly to easily swap in real LLM / STT providers in Phase 2.
 */

export const MOCK_SUGGESTED_QUESTIONS = [
  'Show my overdue leads',
  'What should I do today?',
  'Summarize my pipeline',
  'Summarize ABC Technologies',
  'Show high-value leads',
  'Recent customer activity',
];

/**
 * Handle AI Assistant conversational intents with simulated latency
 */
export const getMockChatResponse = async (userPrompt, contextData = {}) => {
  // Simulate natural AI thinking delay (600ms - 1000ms)
  await new Promise((resolve) => setTimeout(resolve, 800));

  const promptLower = (userPrompt || '').toLowerCase().trim();

  // Intent 1: Overdue leads
  if (promptLower.includes('overdue lead') || promptLower.includes('overdue')) {
    return {
      text: `You currently have 4 overdue leads.

The highest-value overdue lead is **ABC Technologies** with an opportunity value of **₹1,50,000**.

Recommended action: Review scheduled follow-ups and reach out via phone or email to maintain momentum.`,
      intent: 'OVERDUE_LEADS',
      suggestions: ['Summarize ABC Technologies', 'What should I do today?'],
    };
  }

  // Intent 2: Summarize specific lead / ABC Technologies
  if (promptLower.includes('abc technologies') || promptLower.includes('summarize lead')) {
    return {
      text: `**ABC Technologies** is currently in the **Negotiation** stage.

• **Opportunity Value:** ₹1,50,000
• **Primary Contact:** Rahul Sharma (Director of Engineering)
• **Key Highlights:** Customer evaluated the enterprise package and requested a revised quotation with payment terms.
• **Upcoming Follow-up:** Scheduled for September 30, 2026.

Recommended action: Send the updated SLA & commercial quotation today.`,
      intent: 'LEAD_SUMMARY',
      suggestions: ['What should I do today?', 'Summarize my pipeline'],
    };
  }

  // Intent 3: Daily priorities / What should I do today
  if (promptLower.includes('what should i do') || promptLower.includes('today') || promptLower.includes('priority')) {
    return {
      text: `Here is your daily action briefing for today:

• **4 overdue follow-ups** requiring immediate contact
• **2 leads requiring attention** (dormant for > 5 days)
• **1 quotation requested** by ABC Technologies
• **2 demo sessions** scheduled for this afternoon

Focus first on the overdue follow-ups to keep your pipeline velocity high!`,
      intent: 'DAILY_AGENDA',
      suggestions: ['Show my overdue leads', 'Summarize my pipeline'],
    };
  }

  // Intent 4: Pipeline summary
  if (promptLower.includes('pipeline') || promptLower.includes('funnel') || promptLower.includes('stage')) {
    return {
      text: `**Current Pipeline Overview:**

• **New:** 8 leads (~₹4,20,000)
• **Contacted:** 12 leads (~₹6,80,000)
• **Demo Scheduled:** 5 leads (~₹5,50,000)
• **Negotiation:** 3 leads (~₹3,90,000)
• **Qualified:** 6 leads (~₹7,10,000)

**Total Active Pipeline:** 34 opportunities valued at **₹27,50,000**.
Win rate this month is tracking at **68%**.`,
      intent: 'PIPELINE_SUMMARY',
      suggestions: ['Show high-value leads', 'What should I do today?'],
    };
  }

  // Intent 5: High-value leads
  if (promptLower.includes('high-value') || promptLower.includes('high value') || promptLower.includes('top leads')) {
    return {
      text: `**Top High-Value Leads in Your Pipeline:**

1. **ABC Technologies** — ₹1,50,000 (Negotiation)
2. **NexGen Cloud Systems** — ₹1,25,000 (Demo Scheduled)
3. **Global Logistics Hub** — ₹95,000 (Qualified)
4. **Apex Retail Solutions** — ₹80,000 (Contacted)

These 4 accounts represent over 60% of your current potential revenue.`,
      intent: 'HIGH_VALUE_LEADS',
      suggestions: ['Summarize ABC Technologies', 'Recent customer activity'],
    };
  }

  // Intent 6: Recent activity
  if (promptLower.includes('recent') || promptLower.includes('activity') || promptLower.includes('history')) {
    return {
      text: `**Recent CRM Activities:**

• 🎙 **Call logged** with Rahul Sharma (ABC Technologies) — Enterprise requirements reviewed.
• 📅 **Follow-up completed** with Apex Retail Solutions by Sales Rep.
• 🔄 **Lead stage updated** to *Qualified* for Global Logistics Hub.
• ✉️ **Quotation dispatched** to NexGen Cloud Systems.`,
      intent: 'RECENT_ACTIVITY',
      suggestions: ['Show my overdue leads', 'What should I do today?'],
    };
  }

  // Default / Unknown Question Response
  return {
    text: `I'm currently using **demo AI responses** tailored for CRM Lite.

You can ask me to:
• "Show my overdue leads"
• "Summarize ABC Technologies"
• "What should I do today?"
• "Summarize my pipeline"
• "Show high-value leads"

Real AI integration (Gemini, OpenAI, or local LLM) can be connected later via the backend AI service layer.`,
    intent: 'UNKNOWN',
    suggestions: MOCK_SUGGESTED_QUESTIONS.slice(0, 3),
  };
};

/**
 * Standard Mock Transcript
 */
export const MOCK_TRANSCRIPT_CONVERSATION = `Sales Executive:
Hello Rahul, I'm calling regarding your inquiry about CRM Lite enterprise edition.

Customer:
Yes, thanks for following up. We're very interested in the enterprise package for our 25-person sales force, but we need implementation within 30 days.

Sales Executive:
We can certainly provide the full implementation and data migration within 30 days, including dedicated onboarding.

Customer:
That sounds promising. Can you provide a revised quotation with tiered annual billing and SLA terms?

Sales Executive:
Yes, absolutely. I'll prepare and send the revised quotation by tomorrow morning, and schedule a brief check-in for September 30.

Customer:
Perfect, talk soon.`;

/**
 * Standard Mock Structured AI Summary
 */
export const MOCK_STRUCTURED_SUMMARY = {
  summary: 'The customer is interested in the enterprise package for 25 seats and requested a revised quotation with annual billing terms.',
  key_points: [
    'Customer is interested in enterprise package (25 seats)',
    'Pricing and multi-seat discount structure was discussed',
    'Customer requested revised quotation with annual billing',
    'Implementation timeline of 30 days was agreed upon',
  ],
  customer_requirements: [
    'Enterprise package license',
    'Implementation and onboarding within 30 days',
    'Revised quotation with SLA terms',
  ],
  customer_objections: [
    'Pricing and contract terms flexibility',
  ],
  customer_intent: 'High purchase interest',
  next_action: 'Send revised quotation with tiered annual billing',
  suggested_follow_up_date: '2026-09-30',
  call_type: 'Outbound',
  duration_seconds: 755, // 12:35
};
