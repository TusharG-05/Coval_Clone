export interface Agent {
  id: string;
  name: string;
  type: string;
  connection_type: string;
  connection_config: Record<string, unknown>;
  created_at: string;
}

export interface Persona {
  id: string;
  name: string;
  background: string;
  tone: string;
  created_at: string;
}

export interface TestCase {
  scenario: string;
  expected_outcome: string;
}

export interface TestSet {
  id: string;
  name: string;
  description: string;
  test_cases: TestCase[];
  created_at: string;
}

export interface Metric {
  id: string;
  name: string;
  type: string;
  criteria: string;
  created_at: string;
}

export interface MetricResult {
  name: string;
  passed: boolean;
  score: number;
  reasoning: string;
  human_reviewed?: boolean;
  human_reasoning?: string;
}

export interface Message {
  role: string;
  text: string;
  time?: string;
  latency_ms?: number;
}

export interface Simulation {
  id: string;
  agent_id: string;
  persona_id: string;
  test_set_id: string;
  metric_ids: string[];
  mutations?: Record<string, unknown>;
  status: string;
  created_at: string;
  results?: Record<string, MetricResult>;
  transcript?: Message[];
  has_audio?: boolean;
}

export interface Conversation {
  id: string;
  transcript: Message[];
  metric_ids: string[];
  created_at: string;
  results?: Record<string, MetricResult>;
  has_audio?: boolean;
}

export interface Schedule {
  id: string;
  name: string;
  cron_expression: string;
  agent_id: string;
  persona_id: string;
  test_set_id: string;
  metric_ids: string[];
  created_at: string;
  next_run_at: string;
}

export interface TraceSpan {
  name: string;
  duration_ms?: number;
  [key: string]: unknown;
}

export interface Trace {
  id: string;
  run_id: string;
  spans: TraceSpan[];
  created_at: string;
}
