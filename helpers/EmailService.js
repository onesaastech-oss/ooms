/**
 * Email Service
 * Handles email sending with configurable SMTP settings
 * Supports template variables, attachments, and retry logic
 */

import nodemailer from 'nodemailer';
import pool from '../db.js';
import { RSADecrypt } from './RSADecrypt.js';

class EmailService {
  constructor() {
    this.transporter = null;
    this.currentConfig = null;
  }

  /**
   * Get email configuration by config_id or default
   */
  async getConfig(configId = null) {
    try {
      let query, params;

      if (configId) {
        query = 'SELECT * FROM email_configs WHERE config_id = ? AND is_enabled = 1';
        params = [configId];
      } else {
        query = 'SELECT * FROM email_configs WHERE is_default = 1 AND is_enabled = 1 LIMIT 1';
        params = [];
      }

      const [configs] = await pool.query(query, params);

      if (configs.length === 0) {
        throw new Error('No enabled email configuration found');
      }

      return configs[0];
    } catch (error) {
      console.error('Error fetching email config:', error);
      throw error;
    }
  }

  /**
   * Initialize nodemailer transporter with config
   */
  async initializeTransporter(configId = null) {
    try {
      const config = await this.getConfig(configId);

      // Decrypt password from stored encrypted format
      let password;
      try {
        const encryptedData = JSON.parse(config.password);
        password = RSADecrypt(encryptedData);
      } catch (error) {
        // Fallback for raw passwords (backward compatibility)
        console.warn('Password appears to be stored as raw text, consider re-encrypting');
        password = config.password;
      }

      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465, // true for 465, false for other ports
        auth: {
          user: config.username,
          pass: password
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: config.rate_limit_per_minute || 60
      });

      this.currentConfig = config;

      // Verify connection
      await this.transporter.verify();
      console.log('✅ Email transporter initialized and verified');

      return true;
    } catch (error) {
      console.error('Error initializing email transporter:', error);
      throw error;
    }
  }

  /**
   * Send a single email
   */
  async sendEmail({ to, subject, html, text, attachments = [] }) {
    try {
      if (!this.transporter || !this.currentConfig) {
        await this.initializeTransporter();
      }

      const mailOptions = {
        from: `"${this.currentConfig.from_name}" <${this.currentConfig.from_email}>`,
        to,
        subject,
        html,
        text: text || this.htmlToPlainText(html),
        attachments
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      return {
        success: true,
        messageId: info.messageId,
        response: info.response
      };
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Send broadcast email with template variable replacement
   */
  async sendBroadcastEmail(broadcast, recipient) {
    try {
      // Initialize transporter if not already done
      if (!this.transporter || this.currentConfig?.config_id !== broadcast.config_id) {
        await this.initializeTransporter(broadcast.config_id);
      }

      // Replace variables in subject and body
      const variables = {
        name: recipient.name || 'User',
        email: recipient.email,
        first_name: recipient.name ? recipient.name.split(' ')[0] : 'User',
        app_name: 'OOMS'
      };

      const subject = this.replaceVariables(broadcast.subject, variables);
      const html = this.replaceVariables(broadcast.html_body, variables);
      const text = broadcast.plain_text ? this.replaceVariables(broadcast.plain_text, variables) : null;

      // Parse attachments if any
      let attachments = [];
      if (broadcast.attachment_urls) {
        try {
          const urls = JSON.parse(broadcast.attachment_urls);
          attachments = urls.map(url => ({ path: url }));
        } catch (e) {
          console.log('No valid attachments');
        }
      }

      return await this.sendEmail({
        to: recipient.email,
        subject,
        html,
        text,
        attachments
      });
    } catch (error) {
      console.error(`Error sending to ${recipient.email}:`, error);
      throw error;
    }
  }

  /**
   * Replace template variables in text
   */
  replaceVariables(text, variables) {
    if (!text) return text;

    let result = text;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, value || '');
    }

    return result;
  }

  /**
   * Convert HTML to plain text (basic)
   */
  htmlToPlainText(html) {
    if (!html) return '';
    
    return html
      .replace(/<style[^>]*>.*<\/style>/gi, '')
      .replace(/<script[^>]*>.*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Test email configuration
   */
  async testConfig(configId) {
    try {
      await this.initializeTransporter(configId);
      
      // Send test email
      const testResult = await this.sendEmail({
        to: this.currentConfig.from_email,
        subject: 'Test Email - OOMS Email Broadcast',
        html: '<h1>Test Email</h1><p>This is a test email from OOMS Email Broadcast system. If you receive this, your configuration is working correctly!</p>',
        text: 'Test Email - OOMS Email Broadcast. This is a test email. If you receive this, your configuration is working correctly!'
      });

      return {
        success: true,
        message: 'Test email sent successfully',
        messageId: testResult.messageId
      };
    } catch (error) {
      console.error('Email test failed:', error);
      throw error;
    }
  }

  /**
   * Validate template variables
   */
  validateTemplateVariables(template, providedVariables = {}) {
    const variableRegex = /{{(\s*\w+\s*)}}/g;
    const requiredVariables = [];
    let match;

    while ((match = variableRegex.exec(template)) !== null) {
      const variable = match[1].trim();
      if (!requiredVariables.includes(variable)) {
        requiredVariables.push(variable);
      }
    }

    const missingVariables = requiredVariables.filter(
      v => !providedVariables.hasOwnProperty(v)
    );

    return {
      valid: missingVariables.length === 0,
      requiredVariables,
      missingVariables
    };
  }

  /**
   * Close transporter connection
   */
  close() {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
      this.currentConfig = null;
    }
  }
}

export { EmailService };
export default EmailService;

