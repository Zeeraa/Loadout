import { ipcMain } from 'electron';
import axios from 'axios';
import { Loadout } from '../Loadout';
import { WebhookClient } from 'discord.js';
import { DiscordNotifyEvents } from '../config/ConfigurationManager';

export class DiscordManager {
  protected readonly loadout: Loadout

  constructor(loadout: Loadout) {
    this.loadout = loadout;
    this.registerIpcHandlers();
  }

  public getClient() {
    const config = this.loadout.configurationManager.getConfig();
    if (config.discord.enabled && config.discord.webhookUrl != null && config.discord.webhookUrl.trim().length > 0) {
      return new WebhookClient({ url: config.discord.webhookUrl });
    }
    return null;
  }

  /**
   * Send a generic formatted embed notification to the configured Discord channel.
   * Checks if Discord notifications are enabled and if the specified event is subscribed to.
   */
  public async sendNotification(
    event: DiscordNotifyEvents,
    title: string,
    description: string,
    fields: { name: string; value: string; inline?: boolean }[] = [],
    color: number = 11488426, // Amber Gold/Orange (0xAF2A2A equivalent or blurish)
    imageUrl?: string
  ): Promise<boolean> {
    const config = this.loadout.configurationManager.getConfig();
    if (!config.discord.enabled || !config.discord.notificationEvents || !config.discord.notificationEvents.includes(event)) {
      return false;
    }

    const client = this.getClient();
    if (!client) {
      console.error(`[Discord] Webhook client not initialized for event callback: ${event}`);
      return false;
    }

    try {
      await client.send({
        embeds: [
          {
            title,
            description,
            color,
            fields,
            image: imageUrl ? { url: imageUrl } : undefined,
            timestamp: new Date().toISOString()
          }
        ]
      });
      return true;
    } catch (error) {
      console.error(`[Discord] Failed to send webhook payload for ${event}:`, error);
      return false;
    }
  }

  public async sendUpdateStartNofication() {
    return this.sendNotification(
      DiscordNotifyEvents.NotifyStart,
      'Update Loop Started',
      'The Loadout update service has initiated the scheduled game checking sequence.',
      [
        { name: 'Service State', value: 'Active', inline: true }
      ],
      3447003 // Dark Blue (0x3498DB)
    );
  }

  public async sendUpdateFinishNofication() {
    return this.sendNotification(
      DiscordNotifyEvents.NotifyFinish,
      'Update Loop Completed',
      'The scheduled update checklist has successfully run and validated all platform caches.',
      [
        { name: 'Service State', value: 'Idle / Sleeping', inline: true }
      ],
      2067276 // Dark Green (0x1F8B4C)
    );
  }

  public async sendSteamGameUpdateBeginNotification(appId: string | number, gameName: string) {
    const headerUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
    return this.sendNotification(
      DiscordNotifyEvents.NotifyGameUpdateStart,
      'Steam Game Update Started',
      `Installation or file verification checklist has started for **${gameName}** (App ID: ${appId}).`,
      [
        { name: 'Game Title', value: gameName, inline: true },
        { name: 'Application ID', value: String(appId), inline: true }
      ],
      15105570, // Orange (0xE67E22)
      headerUrl
    );
  }

  public async sendSteamGameUpdateConpletedNotification(appId: string | number, gameName: string) {
    const headerUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
    return this.sendNotification(
      DiscordNotifyEvents.NotifyGameUpdateFinish,
      'Steam Game Update Completed',
      `Finished checking and fetching updates for **${gameName}** (App ID: ${appId}). Files are verified and updated on the local storage loop.`,
      [
        { name: 'Game Title', value: gameName, inline: true },
        { name: 'Application ID', value: String(appId), inline: true }
      ],
      3066993, // Green/Teal (0x2ECC71)
      headerUrl
    );
  }

  private registerIpcHandlers(): void {
    ipcMain.handle('discord-test-notification', async () => {
      try {
        const client = this.getClient();
        if (!client) {
          console.error('Discord webhook client could not be initialized.');
          return false;
        }

        await client.send({
          content: '**Loadout Discord Notification Service Test**',
          embeds: [
            {
              title: 'Connection Test Successful!',
              description: 'Your Loadout notification systems have successfully integrated with this Discord webhook. Future system loops, game updates, and startup/shutdown triggers will appear here.',
              color: 16750144, // Theme amber/orange (0xFF9440)
              fields: [
                {
                  name: 'System Status',
                  value: 'Connected & Verified',
                  inline: true
                },
                {
                  name: 'Action Trigger',
                  value: 'Manual Test Request',
                  inline: true
                }
              ],
              timestamp: new Date().toISOString()
            }
          ]
        });

        console.log('Discord test notification sent successfully!');
        return true;
      } catch (error) {
        console.error('Error in discord test notification:', error);
        return false;
      }
    });
  }
}
