export type TaskRun = {
  id: number;
  task_name: string;
  status: string;
  risk_level: string | null;
  observed_at: string;
  started_at: string;
  finished_at: string | null;
  has_summary: boolean;
};

export type TaskRunDetail = TaskRun & {
  deterministic_analysis_json: Record<string, unknown> | null;
  factual_json: Record<string, unknown> | null;
  summary_text: string | null;
};

export type Todo = {
  id: number;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  project: string | null;
  tags: number[];
  waiting_person: string | null;
  created_at: string;
  updated_at: string;
  reviewed: boolean;
  source: string | null;
};

export type TodoTag = {
  id: number;
  name: string;
  color: string | null;
};

export type TodoPerson = {
  id: number;
  name: string;
};

export type Approval = {
  id: number;
  status: string;
  target_label: string;
  summary: string;
  created_at: string;
  updated_at: string;
};

export type ApprovalDetail = Approval & {
  draft_content: string | null;
  evidence_json: Record<string, unknown> | null;
  policy_flags: string[];
  workflow_steps: Array<{
    step: string;
    status: string;
    timestamp: string;
    details: string | null;
  }>;
};

export type AlertDigest = {
  id: number;
  digest_text: string;
  created_at: string;
  triggered_by: string[];
};

export type TaskInfo = {
  task_name: string;
  display_name: string;
  description: string;
};

export type BeszelSystem = {
  name: string;
  status: string;
  latest: {
    cpu: number | null;
    memory: number | null;
    disk: number | null;
    load: number | null;
  };
  updated: string;
};

export type BeszelAlert = {
  id: number;
  systemName: string;
  name: string;
  triggered: boolean;
  value: number;
  min: number;
  created: string;
  updated: string;
};

export type BeszelContainer = {
  id: string;
  name: string;
  status: string;
  systemName: string;
};

export type BeszelData = {
  systems: BeszelSystem[];
  alerts: BeszelAlert[];
  containers: BeszelContainer[];
};

export type TeamStatusMember = {
  name: string;
  tasks: Array<{
    title: string;
    status: string;
  }>;
};

export type TeamStatusDay = {
  date: string;
  members: TeamStatusMember[];
};

export type SupportTicket = {
  id: number;
  subject: string;
  status: string;
  suggestion_status: string | null;
  created_at: string;
};

export type SupportSuggestion = {
  ticket_id: number;
  suggestion_text: string;
  matched_examples: Array<{
    question: string;
    answer: string;
    score: number;
  }>;
};

export type Invoice = {
  id: number;
  filename: string;
  vendor: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  amount_usd: number | null;
  amount_inr: number | null;
  currency_detected: string | null;
  month: string;
  created_at: string;
};

export type InvoiceExtraction = {
  filename: string;
  vendor: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  amount_usd: number | null;
  amount_inr: number | null;
  currency_detected: string | null;
  confidence: string;
  is_duplicate: boolean;
  duplicate_invoice_id: number | null;
};

export type EmailCapture = {
  id: number;
  subject: string;
  from_address: string;
  received_at: string;
  status: string;
  created_todo_ids: number[];
  is_duplicate: boolean;
};

export type EmailCaptureDetail = EmailCapture & {
  body_preview: string | null;
  events: Array<{
    event_type: string;
    timestamp: string;
    details: string | null;
  }>;
};

export type OpenRouterUsage = {
  totalCredits: number;
  totalUsage: number;
  remainingCredits: number;
  usagePercent: number;
  fetchedAt: string;
};

export type HermesMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};
