import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DiscordDeliveryService {
  private readonly logger = new Logger(DiscordDeliveryService.name);

  async sendAlert(
    webhookUrl: string,
    monitorName: string,
    monitorUrl: string,
    status: string,
    error?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const payload = this.formatDiscordMessage(
        monitorName,
        monitorUrl,
        status,
        error,
      );

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(
          `Discord webhook failed: ${response.status} ${text}`,
          webhookUrl,
        );
        return { success: false, error: `HTTP ${response.status}` };
      }

      this.logger.log(
        `Discord alert sent for ${monitorName} (${status})`,
        webhookUrl,
      );
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Discord delivery failed: ${message}`, webhookUrl);
      return { success: false, error: message };
    }
  }

  private formatDiscordMessage(
    monitorName: string,
    monitorUrl: string,
    status: string,
    error?: string,
  ) {
    const isDown = status === 'DOWN';
    const color = isDown ? 16711680 : 5763719; // red : green
    const icon = isDown ? '🔴' : '🟢';

    return {
      content: `${icon} Monitor ${isDown ? 'Down' : 'Recovered'}: ${monitorName}`,
      embeds: [
        {
          title: `Monitor ${isDown ? 'Down' : 'Recovered'}`,
          color: color,
          fields: [
            { name: 'Monitor', value: monitorName },
            { name: 'Status', value: status },
            { name: 'URL', value: `[${monitorUrl}](${monitorUrl})` },
            {
              name: 'Time',
              value: new Date().toISOString(),
            },
            ...(error ? [{ name: 'Error', value: `\`\`\`${error}\`\`\`` }] : []),
          ],
          footer: { text: 'SaaS Pulse Monitoring' },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }
}
