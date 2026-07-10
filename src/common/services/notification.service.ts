import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class NotificationService {
  constructor(private dataSource: DataSource) {}

  /**
   * Save a notification to the database and trigger real-time dispatch mechanisms (e.g., Firebase FCM)
   */
  async sendNotification(
    userId: number | string,
    title: string,
    message: string,
  ): Promise<any> {
    try {
      const results = await this.dataSource.query(
        `INSERT INTO notifications (user_id, title, message, is_read) VALUES ($1, $2, $3, false) RETURNING *`,
        [userId, title, message],
      );
      
      const savedNotification = results[0];

      // Simulate Real-time delivery triggers (Firebase console stub)
      console.log(
        `[Real-time Dispatch] Sent to User #${userId}: "${title}" - ${message}`,
      );

      return savedNotification;
    } catch (error) {
      console.error('Failed to dispatch notification:', error);
      throw error;
    }
  }
}
