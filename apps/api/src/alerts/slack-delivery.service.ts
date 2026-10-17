import { Injectable, Logger } from '@nestjs/common';

export interface SlackMessage {
  text: string;
  blocks: Array<Record<string, any>>;
}

@Injectable()
export class SlackDeliveryService {
  private readonly logger = new Logger(SlackDeliveryService.name);

  /**
   * Send alert to Slack webhook URL
   * Returns { success: boolean, error?: string }
   */
  async sendAlert(
    webhookUrl: string,
    monitorName: string,
    monitorUrl: string,
    status: string,
    error?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const message = this.formatSlackMessage(
        monitorName,
        monitorUrl,
        status,
        error,
      );

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(
          `Slack webhook failed: ${response.status} ${text}`,
          webhookUrl,
        );
        return { success: false, error: `HTTP ${response.status}` };
      }

      this.logger.log(
        `Slack alert sent for ${monitorName} (${status})`,
        webhookUrl,
      );
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Slack delivery failed: ${message}`, webhookUrl);
      return { success: false, error: message };
    }
  }

  /**
   * Format monitor alert as Slack block message
   */
  private formatSlackMessage(
    monitorName: string,
    monitorUrl: string,
    status: string,
    error?: string,
  ): SlackMessage {
    const isDown = status === 'DOWN';
    const icon = isDown ? '🔴' : '🟢';
    const statusText = isDown ? 'Down' : 'Recovered';

    return {
      text: `${icon} Monitor ${statusText}: ${monitorName}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${icon} Monitor ${statusText}`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Monitor:*\n${monitorName}`,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\n${status}`,
            },
            {
              type: 'mrkdwn',
              text: `*URL:*\n<${monitorUrl}|${monitorUrl}>`,
            },
            {
              type: 'mrkdwn',
              text: `*Time:*\n${new Date().toISOString()}`,
            },
          ],
        },
        ...(error
          ? [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Error:*\n\`\`\`${error}\`\`\``,
                },
              },
            ]
          : []),
        {
          type: 'divider',
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Monitor',
              },
              url: `https://saas-pulse.example.com/monitors`, // TODO: Use dynamic base URL
              style: 'primary',
            },
          ],
        },
      ],
    };
  }
}
