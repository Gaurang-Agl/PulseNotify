// Enums matching pulse/models.py
export type UserRole = 'admin' | 'user';
export type AlertStatus = 'active' | 'inactive' | 'triggered';

// Auth Entities
export interface UserProfile {
  username: string;
  role: UserRole;
  access?: string;
}

export interface AuthResponse {
  username: string;
  access: string;
  role: UserRole;
}

// Price Alert Entities
export interface PriceAlert {
  id: number;
  origin: string;
  destination: string;
  threshold_price: string | number;
  status: AlertStatus;
  created_at: string;
}

export interface PriceAlertCreate {
  origin: string;
  destination: string;
  threshold_price: number | string;
}

// Notification Log Entities
export interface NotificationLog {
  id: number;
  alert: number;
  triggered_price: string | number;
  message: string;
  notified_at: string;
}

// Flight Pricing Feed Entities
export interface FlightQuotaStats {
  used_calls: number;
  monthly_limit: number;
  remaining_calls: number;
  percentage: number;
  newly_triggered_alerts: Array<{
    milestone: number;
    percentage: number;
    used_calls: number;
    remaining: number;
    message: string;
    route: string;
    provider: string;
    alert_id: number;
  }>;
}

export interface FlightPriceResponse {
  route: string;
  price: number;
  origin?: string;
  destination?: string;
  provider?: string;
  is_real_time?: boolean;
  airline?: string;
  flight_number?: string;
  currency?: string;
  timestamp?: string;
  quota?: FlightQuotaStats;
  triggered_alerts?: number[];
}

// Quota Telemetry & Audit Entities
export interface QuotaLastRequest {
  route: string;
  provider: string;
  status_code: number;
  timestamp: string | null;
}

export interface QuotaAlertAudit {
  id: number;
  milestone: number;
  consumed_percentage: string | number;
  used_calls: number;
  monthly_limit: number;
  triggering_route: string;
  triggering_provider: string;
  message: string;
  created_at: string;
}

export interface QuotaTelemetry {
  month_key: string;
  monthly_limit: number;
  used_calls: number;
  remaining_calls: number;
  consumed_percentage: number;
  alert_thresholds: number[];
  alerted_milestones: number[];
  last_request: QuotaLastRequest;
  recent_alerts: QuotaAlertAudit[];
}

export interface QuotaSimulationResponse {
  status: string;
  used_calls: number;
  monthly_limit: number;
  percentage: number;
  newly_triggered: Array<{
    milestone: number;
    percentage: number;
    used_calls: number;
    remaining: number;
    message: string;
    alert_id: number;
  }>;
}


// Admin Summary Entities
export interface TopRouteSummary {
  route: string;
  alert_count: number;
}

export interface AdminAlertDetail {
  id: number;
  username: string;
  route: string;
  origin: string;
  destination: string;
  threshold_price: number;
  status: AlertStatus;
  created_at: string;
  triggered_at?: string | null;
  triggered_price?: number | null;
  live_price?: number | null;
  airline?: string | null;
  flight_number?: string | null;
  distance_to_trigger?: number | null;
}

export interface AdminSummaryResponse {
  total_alerts: number;
  active_alerts: number;
  triggered_alerts: number;
  total_notifications: number;
  top_routes: TopRouteSummary[];
  alerts?: AdminAlertDetail[];
}

// API Error Schema
export interface ApiErrorResponse {
  error?: string;
  detail?: string;
  origin?: string[];
  destination?: string[];
  threshold_price?: string[];
  non_field_errors?: string[];
  username?: string[];
  password?: string[];
}
