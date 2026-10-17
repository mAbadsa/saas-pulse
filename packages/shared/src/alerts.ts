/**
 * Alert Channel types and contracts for multi-channel alert delivery
 * Supports: Telegram, Slack, Discord, Email
 */

export enum AlertChannelType {
  TELEGRAM = 'TELEGRAM',
  SLACK = 'SLACK',
  DISCORD = 'DISCORD',
  EMAIL = 'EMAIL',
}

/**
 * Alert Channel DTO - configuration for delivering alerts to a specific channel
 * One channel per user per type (unique constraint on userId + type)
 */
export interface AlertChannelDto {
  id: string;
  userId: string;
  type: AlertChannelType;
  target?: string; // Telegram chat ID (legacy)
  webhookUrl?: string; // Slack/Discord webhook URL
  email?: string; // Email recipient address
  isActive: boolean;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

/**
 * Create/Update Alert Channel request
 */
export interface CreateAlertChannelRequest {
  type: AlertChannelType;
  target?: string; // For TELEGRAM
  webhookUrl?: string; // For SLACK, DISCORD
  email?: string; // For EMAIL
}

/**
 * Test alert channel request - verifies webhook/email delivery
 */
export interface TestAlertChannelRequest {
  monitorName: string;
  monitorUrl: string;
  status: 'UP' | 'DOWN' | 'PENDING';
  error?: string; // Error message if DOWN
}

/**
 * Alert Log DTO - audit trail of alert delivery attempts
 */
export interface AlertLogDto {
  id: string;
  monitorId: string;
  alertChannelId: string;
  status: string; // UP, DOWN, PENDING
  channelType: AlertChannelType;
  deliveryStatus: 'SUCCESS' | 'FAILED' | 'RETRYING';
  errorMessage?: string;
  retryCount: number;
  timestamp: string; // ISO 8601
  completedAt?: string; // ISO 8601, null if still retrying
}

/**
 * Slack webhook payload - formatted message block
 */
export interface SlackWebhookPayload {
  text: string;
  blocks?: Array<Record<string, any>>;
}

/**
 * Discord webhook payload - embed message format
 */
export interface DiscordWebhookPayload {
  content: string;
  embeds?: Array<Record<string, any>>;
  components?: Array<Record<string, any>>;
}

/**
 * Email payload for SMTP delivery
 */
export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Monitor alert event - fired when monitor status changes
 */
export interface MonitorAlertEvent {
  monitorId: string;
  monitorName: string;
  monitorUrl: string;
  status: 'UP' | 'DOWN' | 'PENDING';
  error?: string; // Error message if DOWN
  timestamp: number; // Unix timestamp in ms
}

/**
 * Alert delivery result
 */
export interface AlertDeliveryResult {
  success: boolean;
  message: string;
  errorDetails?: string;
}
