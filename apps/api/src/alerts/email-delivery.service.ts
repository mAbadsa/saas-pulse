import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailDeliveryService implements OnModuleInit {
  private readonly logger = new Logger(EmailDeliveryService.name);
  private transporter: nodemailer.Transporter;

  onModuleInit() {
    // Initialize SMTP transporter from env variables
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
    });

    this.logger.log(`Email delivery configured: ${process.env.SMTP_HOST}`);
  }

  async sendAlert(
    recipient: string,
    monitorName: string,
    monitorUrl: string,
    status: string,
    error?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const isDown = status === 'DOWN';
      const subject = isDown
        ? `🔴 Monitor Down: ${monitorName}`
        : `🟢 Monitor Recovered: ${monitorName}`;

      const html = this.formatEmailHtml(
        monitorName,
        monitorUrl,
        status,
        error,
      );

      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@saas-pulse.local',
        to: recipient,
        subject,
        html,
      });

      this.logger.log(
        `Email alert sent to ${recipient} for ${monitorName} (${status})`,
      );
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Email delivery failed to ${recipient}: ${message}`,
      );
      return { success: false, error: message };
    }
  }

  private formatEmailHtml(
    monitorName: string,
    monitorUrl: string,
    status: string,
    error?: string,
  ): string {
    const isDown = status === 'DOWN';
    const icon = isDown ? '🔴' : '🟢';
    const statusText = isDown ? 'Down' : 'Recovered';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${isDown ? '#fee2e2' : '#dcfce7'}; border-left: 4px solid ${isDown ? '#dc2626' : '#16a34a'}; padding: 20px; margin-bottom: 20px; }
            .header h1 { margin: 0; color: ${isDown ? '#dc2626' : '#16a34a'}; }
            .details { background: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .detail-row { display: flex; margin-bottom: 10px; }
            .detail-label { font-weight: 600; width: 120px; }
            .error { background: #fecaca; border-left: 3px solid #dc2626; padding: 10px 15px; margin: 15px 0; font-family: monospace; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 15px; }
            .footer { color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${icon} Monitor ${statusText}</h1>
            </div>

            <div class="details">
              <div class="detail-row">
                <span class="detail-label">Monitor:</span>
                <span>${monitorName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Status:</span>
                <span>${status}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">URL:</span>
                <span><a href="${monitorUrl}">${monitorUrl}</a></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Time:</span>
                <span>${new Date().toISOString()}</span>
              </div>
            </div>

            ${error ? `<div class="error"><strong>Error:</strong><br>${error}</div>` : ''}

            <a href="https://saas-pulse.example.com/monitors" class="button">View Dashboard</a>

            <div class="footer">
              <p>SaaS Pulse Monitoring • ${new Date().getFullYear()}</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}
