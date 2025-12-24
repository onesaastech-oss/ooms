/**
 * Email Broadcast Queue System
 * Simple in-memory queue with persistence to database
 * Handles job queuing, processing, and retry logic
 */

import pool from '../db.js';
import { RANDOM_STRING } from './function.js';
import EventEmitter from 'events';

class EmailBroadcastQueue extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.processing = false;
    this.processingJob = null;
    this.maxConcurrent = 1; // Process one broadcast at a time
    this.retryAttempts = 3;
  }

  /**
   * Add a broadcast job to the queue
   */
  async enqueue(broadcastId) {
    try {
      // Check if already in queue
      if (this.queue.includes(broadcastId)) {
        console.log(`Broadcast ${broadcastId} already in queue`);
        return { success: true, message: 'Already queued' };
      }

      // Verify broadcast exists
      const [broadcasts] = await pool.query(
        'SELECT broadcast_id, status FROM email_broadcasts WHERE broadcast_id = ?',
        [broadcastId]
      );

      if (broadcasts.length === 0) {
        throw new Error('Broadcast not found');
      }

      const broadcast = broadcasts[0];
      
      // Only queue if status is 'queued'
      if (broadcast.status !== 'queued') {
        throw new Error(`Broadcast status is ${broadcast.status}, cannot queue`);
      }

      this.queue.push(broadcastId);
      console.log(`📧 Broadcast ${broadcastId} added to queue. Queue length: ${this.queue.length}`);

      // Start processing if not already processing
      if (!this.processing) {
        this.processQueue();
      }

      return { success: true, message: 'Job queued successfully' };
    } catch (error) {
      console.error('Error enqueueing broadcast:', error);
      throw error;
    }
  }

  /**
   * Process the queue
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const broadcastId = this.queue.shift();
        this.processingJob = broadcastId;

        console.log(`\n${'='.repeat(60)}`);
        console.log(`🚀 Processing broadcast: ${broadcastId}`);
        console.log(`📊 Remaining in queue: ${this.queue.length}`);
        console.log(`${'='.repeat(60)}\n`);

        await this.processBroadcast(broadcastId);
        
        this.processingJob = null;
      }
    } catch (error) {
      console.error('Error processing queue:', error);
    } finally {
      this.processing = false;
      this.processingJob = null;
    }
  }

  /**
   * Process a single broadcast
   */
  async processBroadcast(broadcastId) {
    try {
      // Get broadcast details
      const [broadcasts] = await pool.query(
        'SELECT * FROM email_broadcasts WHERE broadcast_id = ?',
        [broadcastId]
      );

      if (broadcasts.length === 0) {
        console.error(`Broadcast ${broadcastId} not found`);
        return;
      }

      const broadcast = broadcasts[0];

      // Update status to processing
      await pool.query(
        'UPDATE email_broadcasts SET status = ?, start_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE broadcast_id = ?',
        ['processing', broadcastId]
      );

      // Get recipients
      const recipients = await this.getRecipients(broadcast);
      
      if (recipients.length === 0) {
        await pool.query(
          'UPDATE email_broadcasts SET status = ?, error_message = ?, end_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE broadcast_id = ?',
          ['failed', 'No recipients found', broadcastId]
        );
        console.log(`❌ No recipients found for broadcast ${broadcastId}`);
        return;
      }

      console.log(`📧 Total recipients: ${recipients.length}`);

      // Update total recipients
      await pool.query(
        'UPDATE email_broadcasts SET total_recipients = ?, queued_count = ?, updated_at = CURRENT_TIMESTAMP WHERE broadcast_id = ?',
        [recipients.length, recipients.length, broadcastId]
      );

      // Process in batches
      await this.processBatches(broadcast, recipients);

      // Calculate final stats
      const [stats] = await pool.query(
        'SELECT COUNT(*) as total, SUM(CASE WHEN status = "sent" THEN 1 ELSE 0 END) as sent, SUM(CASE WHEN status = "failed" THEN 1 ELSE 0 END) as failed FROM email_broadcast_logs WHERE broadcast_id = ?',
        [broadcastId]
      );

      const totalSent = stats[0]?.sent || 0;
      const totalFailed = stats[0]?.failed || 0;
      // Update broadcast with final stats
      await pool.query(
        'UPDATE email_broadcasts SET status = ?, sent_count = ?, failed_count = ?, end_time = CURRENT_TIMESTAMP, duration_seconds = TIMESTAMPDIFF(SECOND, start_time, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE broadcast_id = ?',
        ['completed', totalSent, totalFailed, broadcastId]
      );

      console.log(`\n✅ Broadcast ${broadcastId} completed!`);
      console.log(`   Sent: ${totalSent}, Failed: ${totalFailed}\n`);

      this.emit('broadcast_completed', { broadcastId, totalSent, totalFailed });

    } catch (error) {
      console.error(`Error processing broadcast ${broadcastId}:`, error);
      
      await pool.query(
        'UPDATE email_broadcasts SET status = ?, error_message = ?, end_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE broadcast_id = ?',
        ['failed', error.message, broadcastId]
      );
    }
  }

  /**
   * Get recipients based on recipient_type
   */
  async getRecipients(broadcast) {
    const recipients = [];
    const recipientFilter = broadcast.recipient_filter ? JSON.parse(broadcast.recipient_filter) : {};

    try {
      if (broadcast.recipient_type === 'all_users') {
        // Get all active users
        const [users] = await pool.query(
          'SELECT email, CONCAT(first_name, " ", last_name) as name FROM users WHERE status = ? AND email IS NOT NULL AND email != ""',
          ['1']
        );
        recipients.push(...users);
      } 
      else if (broadcast.recipient_type === 'all_clients') {
        // Get all active clients (not deleted, with email)
        // Note: is_deleted and status are ENUM('0','1') fields, so use string values
        const [clients] = await pool.query(
          'SELECT email, name FROM clients WHERE is_deleted = ? AND status = ? AND email IS NOT NULL AND email != ""',
          ['0', '1']
        );
        recipients.push(...clients);
      }
      else if (broadcast.recipient_type === 'role_based') {
        // Get users by roles
        const roles = recipientFilter.roles || [];
        if (roles.length > 0) {
          const placeholders = roles.map(() => '?').join(',');
          const [users] = await pool.query(
            `SELECT DISTINCT u.email, CONCAT(u.first_name, " ", u.last_name) as name 
             FROM users u 
             LEFT JOIN branch_mapping bm ON u.username = bm.username 
             WHERE u.status = ? AND u.email IS NOT NULL AND u.email != "" 
             AND (bm.type IN (${placeholders}) OR u.role IN (${placeholders}))`,
            ['1', ...roles, ...roles]
          );
          recipients.push(...users);
        }
      } 
      else if (broadcast.recipient_type === 'uploaded_list') {
        // Get from uploaded list
        const emails = recipientFilter.emails || [];
        recipients.push(...emails.map(item => {
          // Handle both string emails and object format
          if (typeof item === 'string') {
            return { email: item, name: null };
          } else if (typeof item === 'object' && item.email) {
            return { email: item.email, name: item.name || null };
          }
          return null;
        }).filter(Boolean));
      }
      else if (broadcast.recipient_type === 'group') {
        // Get recipients from a group
        // Flow: group_id -> group_firms (firm_ids) -> firms (usernames) -> users (emails)
        const groupId = recipientFilter.group_id;
        
        if (!groupId) {
          console.error('group_id is required for group recipient_type');
          return recipients;
        }

        // Step 1: Get all firm_ids from group_firms table for this group
        const [groupFirms] = await pool.query(
          `SELECT firm_id 
           FROM group_firms 
           WHERE group_id = ? AND (is_deleted = ? OR is_deleted = 0)`,
          [groupId, '0']
        );

        if (groupFirms.length === 0) {
          console.log(`No firms found in group ${groupId}`);
          return recipients;
        }

        const firmIds = groupFirms.map(gf => gf.firm_id);

        // Step 2: Get usernames from firms table
        const placeholders = firmIds.map(() => '?').join(',');
        const [firms] = await pool.query(
          `SELECT DISTINCT username 
           FROM firms 
           WHERE firm_id IN (${placeholders}) 
           AND (is_deleted = ? OR is_deleted = 0) 
           AND (status = ? OR status = 1) 
           AND username IS NOT NULL 
           AND username != ''`,
          [...firmIds, '0', '1']
        );

        if (firms.length === 0) {
          console.log(`No active firms with usernames found in group ${groupId}`);
          return recipients;
        }

        const usernames = firms.map(f => f.username);

        // Step 3: Get user emails from users table
        const userPlaceholders = usernames.map(() => '?').join(',');
        const [users] = await pool.query(
          `SELECT email, CONCAT(first_name, " ", last_name) as name 
           FROM users 
           WHERE username IN (${userPlaceholders}) 
           AND status = ? 
           AND email IS NOT NULL 
           AND email != ""`,
          [...usernames, '1']
        );

        recipients.push(...users);
      }
    } catch (error) {
      console.error('Error fetching recipients:', error);
    }

    // Remove duplicates
    const uniqueRecipients = [];
    const seenEmails = new Set();
    
    for (const recipient of recipients) {
      if (!seenEmails.has(recipient.email)) {
        seenEmails.add(recipient.email);
        uniqueRecipients.push(recipient);
      }
    }

    return uniqueRecipients;
  }

  /**
   * Process batches
   */
  async processBatches(broadcast, recipients) {
    const batchSize = broadcast.batch_size || 100;
    const batchDelay = (broadcast.batch_delay_seconds || 3) * 1000; // Convert to ms
    const totalBatches = Math.ceil(recipients.length / batchSize);

    console.log(`📦 Processing ${totalBatches} batch(es) with size ${batchSize}`);

    for (let i = 0; i < totalBatches; i++) {
      const batchNumber = i + 1;
      const batchRecipients = recipients.slice(i * batchSize, (i + 1) * batchSize);
      
      console.log(`\n📤 Processing batch ${batchNumber}/${totalBatches} (${batchRecipients.length} recipients)`);
      
      await this.processBatch(broadcast, batchRecipients, batchNumber);

      // Delay between batches (except for the last batch)
      if (i < totalBatches - 1) {
        console.log(`⏳ Waiting ${broadcast.batch_delay_seconds}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }
  }

  /**
   * Process a single batch
   */
  async processBatch(broadcast, recipients, batchNumber) {
    const batchId = RANDOM_STRING(30);

    try {
      // Create batch record
      await pool.query(
        'INSERT INTO email_broadcast_batches (batch_id, broadcast_id, batch_number, batch_size, status, start_time) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [batchId, broadcast.broadcast_id, batchNumber, recipients.length, 'processing']
      );

      // Create log entries for all recipients
      for (const recipient of recipients) {
        const logId = RANDOM_STRING(30);
        await pool.query(
          'INSERT INTO email_broadcast_logs (log_id, broadcast_id, batch_id, recipient_email, recipient_name, status, max_retries) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [logId, broadcast.broadcast_id, batchId, recipient.email, recipient.name, 'queued', 3]
        );
      }

      // Import EmailService dynamically to avoid circular dependencies
      const { EmailService } = await import('./EmailService.js');
      const emailService = new EmailService();

      let sentCount = 0;
      let failedCount = 0;

      // Send emails
      for (const recipient of recipients) {
        try {
          await emailService.sendBroadcastEmail(broadcast, recipient);
          sentCount++;
          
          // Update log status
          await pool.query(
            'UPDATE email_broadcast_logs SET status = ?, sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE broadcast_id = ? AND batch_id = ? AND recipient_email = ?',
            ['sent', broadcast.broadcast_id, batchId, recipient.email]
          );

          process.stdout.write('.');
        } catch (error) {
          failedCount++;
          
          // Update log with error
          await pool.query(
            'UPDATE email_broadcast_logs SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE broadcast_id = ? AND batch_id = ? AND recipient_email = ?',
            ['failed', error.message, broadcast.broadcast_id, batchId, recipient.email]
          );

          process.stdout.write('x');
        }
      }

      console.log(''); // New line after progress dots

      // Update batch status
      await pool.query(
        'UPDATE email_broadcast_batches SET status = ?, sent_count = ?, failed_count = ?, end_time = CURRENT_TIMESTAMP, processing_time_ms = (TIMESTAMPDIFF(MICROSECOND, start_time, CURRENT_TIMESTAMP) / 1000), updated_at = CURRENT_TIMESTAMP WHERE batch_id = ?',
        ['completed', sentCount, failedCount, batchId]
      );

      console.log(`✅ Batch ${batchNumber} completed: ${sentCount} sent, ${failedCount} failed`);

    } catch (error) {
      console.error(`Error processing batch ${batchNumber}:`, error);
      
      await pool.query(
        'UPDATE email_broadcast_batches SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE batch_id = ?',
        ['failed', error.message, batchId]
      );
    }
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      currentJob: this.processingJob,
      queue: this.queue
    };
  }
}

// Singleton instance
const queueInstance = new EmailBroadcastQueue();

export default queueInstance;
export { EmailBroadcastQueue };

