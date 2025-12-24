/**
 * Email Broadcast Routes
 * Provides APIs for email broadcasting, templates, config, and reports
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import xlsx from 'xlsx';
const router = express.Router();

import pool from '../../db.js';
import { auth } from '../../middleware/auth.js';
import { RANDOM_STRING, UNIX_TIMESTAMP } from '../../helpers/function.js';
import { Encrypt } from '../../helpers/Encrypt.js';
import { Decrypt } from '../../helpers/Decrypt.js';
import EmailBroadcastQueue from '../../helpers/EmailBroadcastQueue.js';
import { EmailService } from '../../helpers/EmailService.js';

// Configure multer for CSV/Excel uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './media/upload/broadcasts';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${RANDOM_STRING(10)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ============================================
// EMAIL CONFIG ROUTES
// ============================================

/**
 * GET /broadcast/email/config
 * Get all email configurations
 */
router.get('/config', auth, async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Get all email configurations'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    const [configs] = await pool.query(
      'SELECT id, config_id, name, provider, host, port, username, from_name, from_email, is_default, is_enabled, rate_limit_per_minute, created_at, updated_at, created_by FROM email_configs ORDER BY is_default DESC, created_at DESC'
    );

    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('Error fetching email configs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email configurations',
      error: error.message
    });
  }
});

/**
 * GET /broadcast/email/config/:configId
 * Get single email configuration
 */
router.get('/config/:configId', auth, async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Get email configuration by ID'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    const { configId } = req.params;

    const [configs] = await pool.query(
      'SELECT id, config_id, name, provider, host, port, username, from_name, from_email, is_default, is_enabled, rate_limit_per_minute, created_at, updated_at, created_by FROM email_configs WHERE config_id = ?',
      [configId]
    );

    if (configs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Email configuration not found'
      });
    }

    res.json({
      success: true,
      data: configs[0]
    });
  } catch (error) {
    console.error('Error fetching email config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email configuration',
      error: error.message
    });
  }
});

/**
 * POST /broadcast/email/config
 * Create new email configuration
 */
router.post('/config', auth, async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Create email configuration'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    const {
      name,
      provider = 'smtp',
      host,
      port,
      username,
      password,
      from_name,
      from_email,
      is_default = 0,
      rate_limit_per_minute = 60
    } = req.body;

    const createdBy = req.headers['username'] || '';

    // Validation
    if (!name || !host || !port || !username || !password || !from_name || !from_email) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Encrypt password before storing
    const encryptedPassword = Encrypt(password);
    const configId = RANDOM_STRING(30);

    // If setting as default, unset other defaults
    if (is_default) {
      await pool.query('UPDATE email_configs SET is_default = 0, updated_at = ?', [UNIX_TIMESTAMP()]);
    }

    // Store password - if encryption worked, store as JSON, otherwise store as plain text
    const passwordToStore = (typeof encryptedPassword === 'object' && encryptedPassword.data) 
      ? JSON.stringify(encryptedPassword) 
      : encryptedPassword;

    await pool.query(
      'INSERT INTO email_configs (config_id, name, provider, host, port, username, password, from_name, from_email, is_default, is_enabled, rate_limit_per_minute, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [configId, name, provider, host, port, username, passwordToStore, from_name, from_email, is_default, 1, rate_limit_per_minute, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), createdBy]
    );

    res.json({
      success: true,
      message: 'Email configuration created successfully',
      data: { config_id: configId }
    });
  } catch (error) {
    console.error('Error creating email config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create email configuration',
      error: error.message
    });
  }
});

/**
 * PUT /broadcast/email/config/:configId
 * Update email configuration
 */
router.put('/config/:configId', auth, async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Update email configuration'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    const { configId } = req.params;
    const {
      name,
      host,
      port,
      username,
      password,
      from_name,
      from_email,
      is_default,
      is_enabled,
      rate_limit_per_minute
    } = req.body;

    const updatedBy = req.headers['username'] || '';

    // Check if config exists
    const [existing] = await pool.query(
      'SELECT id FROM email_configs WHERE config_id = ?',
      [configId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Email configuration not found'
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (host !== undefined) {
      updates.push('host = ?');
      values.push(host);
    }
    if (port !== undefined) {
      updates.push('port = ?');
      values.push(port);
    }
    if (username !== undefined) {
      updates.push('username = ?');
      values.push(username);
    }
    if (password !== undefined) {
      updates.push('password = ?');
      const encryptedPassword = Encrypt(password);
      const passwordToStore = (typeof encryptedPassword === 'object' && encryptedPassword.data) 
        ? JSON.stringify(encryptedPassword) 
        : encryptedPassword;
      values.push(passwordToStore);
    }
    if (from_name !== undefined) {
      updates.push('from_name = ?');
      values.push(from_name);
    }
    if (from_email !== undefined) {
      updates.push('from_email = ?');
      values.push(from_email);
    }
    if (is_default !== undefined) {
      updates.push('is_default = ?');
      values.push(is_default);
      
      // If setting as default, unset other defaults
      if (is_default) {
        await pool.query('UPDATE email_configs SET is_default = 0, updated_at = ? WHERE config_id != ?', [UNIX_TIMESTAMP(), configId]);
      }
    }
    if (is_enabled !== undefined) {
      updates.push('is_enabled = ?');
      values.push(is_enabled);
    }
    if (rate_limit_per_minute !== undefined) {
      updates.push('rate_limit_per_minute = ?');
      values.push(rate_limit_per_minute);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push('updated_at = ?');
    values.push(UNIX_TIMESTAMP());
    updates.push('updated_by = ?');
    values.push(updatedBy);

    values.push(configId);

    await pool.query(
      `UPDATE email_configs SET ${updates.join(', ')} WHERE config_id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Email configuration updated successfully'
    });
  } catch (error) {
    console.error('Error updating email config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update email configuration',
      error: error.message
    });
  }
});

/**
 * DELETE /broadcast/email/config/:configId
 * Delete email configuration
 */
router.delete('/config/:configId', auth, async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Delete email configuration'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    const { configId } = req.params;

    // Check if config exists
    const [existing] = await pool.query(
      'SELECT id, is_default FROM email_configs WHERE config_id = ?',
      [configId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Email configuration not found'
      });
    }

    // Don't allow deleting default config if it's the only one
    if (existing[0].is_default) {
      const [allConfigs] = await pool.query('SELECT COUNT(*) as count FROM email_configs');
      if (allConfigs[0].count === 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the only email configuration'
        });
      }
    }

    await pool.query('DELETE FROM email_configs WHERE config_id = ?', [configId]);

    res.json({
      success: true,
      message: 'Email configuration deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting email config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete email configuration',
      error: error.message
    });
  }
});

/**
 * POST /broadcast/email/config/test
 * Test email configuration
 */
router.post('/config/test', auth, async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Test email configuration'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    const { config_id, test_email } = req.body;

    if (!config_id) {
      return res.status(400).json({
        success: false,
        message: 'config_id is required'
      });
    }

    const emailService = new EmailService();
    const result = await emailService.testConfig(config_id);

    res.json({
      success: true,
      message: `Test email sent successfully${test_email ? ` to ${test_email}` : ''}`,
      data: result
    });
  } catch (error) {
    console.error('Error testing email config:', error);
    res.status(500).json({
      success: false,
      message: 'Email test failed',
      error: error.message
    });
  }
});

// ============================================
// EMAIL TEMPLATE ROUTES
// ============================================

/**
 * GET /broadcast/email/templates
 * Get all email templates
 */
router.get('/templates', auth, async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Get all email templates'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    const [templates] = await pool.query(
      'SELECT * FROM email_templates ORDER BY created_at DESC'
    );

    // Parse JSON fields
    const parsedTemplates = templates.map(template => ({
      ...template,
      variables: template.variables ? JSON.parse(template.variables) : []
    }));

    res.json({
      success: true,
      data: parsedTemplates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email templates',
      error: error.message
    });
  }
});

/**
 * GET /broadcast/email/templates/:templateId
 * Get single email template
 */
router.get('/templates/:templateId', auth, async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Get email template by ID'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    const { templateId } = req.params;

    const [templates] = await pool.query(
      'SELECT * FROM email_templates WHERE template_id = ?',
      [templateId]
    );

    if (templates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    const template = {
      ...templates[0],
      variables: templates[0].variables ? JSON.parse(templates[0].variables) : []
    };

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch email template',
      error: error.message
    });
  }
});

/**
 * POST /broadcast/email/templates
 * Create new email template
 */
router.post('/templates', auth, async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Create email template'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    const {
      name,
      subject,
      html_body,
      plain_text,
      variables = [],
      description
    } = req.body;

    const createdBy = req.headers['username'] || '';

    // Validation
    if (!name || !subject || !html_body) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields (name, subject, html_body)'
      });
    }

    const templateId = RANDOM_STRING(30);

    await pool.query(
      'INSERT INTO email_templates (template_id, name, subject, html_body, plain_text, variables, description, is_active, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [templateId, name, subject, html_body, plain_text, JSON.stringify(variables), description, 1, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), createdBy]
    );

    res.json({
      success: true,
      message: 'Email template created successfully',
      data: { template_id: templateId }
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create email template',
      error: error.message
    });
  }
});

/**
 * PUT /broadcast/email/templates/:templateId
 * Update email template
 */
router.put('/templates/:templateId', auth, async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Update email template'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    const { templateId } = req.params;
    const {
      name,
      subject,
      html_body,
      plain_text,
      variables,
      description,
      is_active
    } = req.body;

    const updatedBy = req.headers['username'] || '';

    // Check if template exists
    const [existing] = await pool.query(
      'SELECT id FROM email_templates WHERE template_id = ?',
      [templateId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (subject !== undefined) {
      updates.push('subject = ?');
      values.push(subject);
    }
    if (html_body !== undefined) {
      updates.push('html_body = ?');
      values.push(html_body);
    }
    if (plain_text !== undefined) {
      updates.push('plain_text = ?');
      values.push(plain_text);
    }
    if (variables !== undefined) {
      updates.push('variables = ?');
      values.push(JSON.stringify(variables));
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updates.push('updated_at = ?');
    values.push(UNIX_TIMESTAMP());
    updates.push('updated_by = ?');
    values.push(updatedBy);

    values.push(templateId);

    await pool.query(
      `UPDATE email_templates SET ${updates.join(', ')} WHERE template_id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Email template updated successfully'
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update email template',
      error: error.message
    });
  }
});

/**
 * DELETE /broadcast/email/templates/:templateId
 * Delete email template
 */
router.delete('/templates/:templateId', auth, async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Delete email template'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    const { templateId } = req.params;

    // Check if template exists
    const [existing] = await pool.query(
      'SELECT id FROM email_templates WHERE template_id = ?',
      [templateId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    await pool.query('DELETE FROM email_templates WHERE template_id = ?', [templateId]);

    res.json({
      success: true,
      message: 'Email template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete email template',
      error: error.message
    });
  }
});

/**
 * POST /broadcast/email/templates/:templateId/preview
 * Preview email template with variables
 */
router.post('/templates/:templateId/preview', auth, async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Preview email template'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    const { templateId } = req.params;
    const { variables = {} } = req.body;

    const [templates] = await pool.query(
      'SELECT * FROM email_templates WHERE template_id = ?',
      [templateId]
    );

    if (templates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    const template = templates[0];
    const emailService = new EmailService();

    // Replace variables
    const subject = emailService.replaceVariables(template.subject, variables);
    const html_body = emailService.replaceVariables(template.html_body, variables);
    const plain_text = template.plain_text ? emailService.replaceVariables(template.plain_text, variables) : null;

    // Validate variables
    const validation = emailService.validateTemplateVariables(
      template.subject + ' ' + template.html_body,
      variables
    );

    res.json({
      success: true,
      data: {
        subject,
        html_body,
        plain_text,
        validation
      }
    });
  } catch (error) {
    console.error('Error previewing template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to preview template',
      error: error.message
    });
  }
});

// ============================================
// EMAIL BROADCAST ROUTES
// ============================================

/**
 * POST /broadcast/email/send
 * Send email broadcast (enqueues job)
 */
router.post('/send', auth, async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Send email broadcast'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    const {
      name,
      subject,
      html_body,
      plain_text,
      template_id,
      config_id,
      recipient_type, // all_users, role_based, uploaded_list, all_clients, group
      recipient_filter, // { roles: [], emails: [], group_id: '' }
      group_id, // For group recipient_type
      attachment_urls,
      batch_size = 100,
      batch_delay_seconds = 3
    } = req.body;

    const createdBy = req.headers['username'] || '';

    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Broadcast name is required'
      });
    }

    if (!recipient_type || !['all_users', 'role_based', 'uploaded_list', 'all_clients', 'group'].includes(recipient_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid recipient_type. Must be: all_users, role_based, uploaded_list, all_clients, or group'
      });
    }

    // Validate group_id if recipient_type is 'group'
    if (recipient_type === 'group') {
      const finalGroupId = group_id || (recipient_filter && recipient_filter.group_id);
      if (!finalGroupId) {
        return res.status(400).json({
          success: false,
          message: 'group_id is required when recipient_type is "group"'
        });
      }
      // Ensure group_id is included in recipient_filter
      if (!recipient_filter) {
        recipient_filter = {};
      }
      recipient_filter.group_id = finalGroupId;
    }

    // If template is provided, load it
    let finalSubject = subject;
    let finalHtmlBody = html_body;
    let finalPlainText = plain_text;

    if (template_id) {
      const [templates] = await pool.query(
        'SELECT * FROM email_templates WHERE template_id = ? AND is_active = 1',
        [template_id]
      );

      if (templates.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Template not found or inactive'
        });
      }

      const template = templates[0];
      finalSubject = template.subject;
      finalHtmlBody = template.html_body;
      finalPlainText = template.plain_text;
    }

    if (!finalSubject || !finalHtmlBody) {
      return res.status(400).json({
        success: false,
        message: 'Subject and html_body are required (either directly or via template)'
      });
    }

    // Get config or use default
    let finalConfigId = config_id;
    if (!finalConfigId) {
      const [defaultConfig] = await pool.query(
        'SELECT config_id FROM email_configs WHERE is_default = 1 AND is_enabled = 1 LIMIT 1'
      );
      if (defaultConfig.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No default email configuration found'
        });
      }
      finalConfigId = defaultConfig[0].config_id;
    }

    // Create broadcast record
    const broadcastId = RANDOM_STRING(30);

    await pool.query(
      `INSERT INTO email_broadcasts (
        broadcast_id, channel, name, subject, html_body, plain_text, template_id, 
        config_id, recipient_type, recipient_filter, attachment_urls, 
        batch_size, batch_delay_seconds, status, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        broadcastId,
        'email',
        name,
        finalSubject,
        finalHtmlBody,
        finalPlainText,
        template_id || null,
        finalConfigId,
        recipient_type,
        JSON.stringify(recipient_filter || {}),
        JSON.stringify(attachment_urls || []),
        batch_size,
        batch_delay_seconds,
        'queued',
        UNIX_TIMESTAMP(),
        UNIX_TIMESTAMP(),
        createdBy
      ]
    );

    // Enqueue broadcast job
    await EmailBroadcastQueue.enqueue(broadcastId);

    res.json({
      success: true,
      message: 'Email broadcast queued successfully',
      data: {
        broadcast_id: broadcastId,
        status: 'queued'
      }
    });
  } catch (error) {
    console.error('Error sending broadcast:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to queue email broadcast',
      error: error.message
    });
  }
});

/**
 * POST /broadcast/email/upload-recipients
 * Upload recipient list (CSV/Excel)
 */
router.post('/upload-recipients', auth, upload.single('file'), async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Upload recipient list from CSV/Excel'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    let emails = [];

    if (ext === '.csv') {
      // Parse CSV
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);

      emails = data
        .map(row => {
          // Try to find email field (case insensitive)
          const emailKey = Object.keys(row).find(key => 
            key.toLowerCase().includes('email') || key.toLowerCase() === 'e-mail'
          );
          const nameKey = Object.keys(row).find(key => 
            key.toLowerCase().includes('name')
          );

          return {
            email: emailKey ? row[emailKey] : null,
            name: nameKey ? row[nameKey] : null
          };
        })
        .filter(item => item.email && item.email.includes('@'));
    } else {
      // Parse Excel
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);

      emails = data
        .map(row => {
          const emailKey = Object.keys(row).find(key => 
            key.toLowerCase().includes('email') || key.toLowerCase() === 'e-mail'
          );
          const nameKey = Object.keys(row).find(key => 
            key.toLowerCase().includes('name')
          );

          return {
            email: emailKey ? row[emailKey] : null,
            name: nameKey ? row[nameKey] : null
          };
        })
        .filter(item => item.email && item.email.includes('@'));
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    if (emails.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid email addresses found in the file'
      });
    }

    res.json({
      success: true,
      message: `Successfully parsed ${emails.length} email addresses`,
      data: {
        count: emails.length,
        emails
      }
    });
  } catch (error) {
    console.error('Error uploading recipients:', error);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to process recipient file',
      error: error.message
    });
  }
});

/**
 * GET /broadcast/email/list
 * Get all email broadcasts
 */
router.get('/list', auth, async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Get all email broadcasts'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM email_broadcasts';
    const params = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [broadcasts] = await pool.query(query, params);

    // Parse JSON fields
    const parsedBroadcasts = broadcasts.map(broadcast => ({
      ...broadcast,
      recipient_filter: broadcast.recipient_filter ? JSON.parse(broadcast.recipient_filter) : {},
      attachment_urls: broadcast.attachment_urls ? JSON.parse(broadcast.attachment_urls) : []
    }));

    res.json({
      success: true,
      data: parsedBroadcasts
    });
  } catch (error) {
    console.error('Error fetching broadcasts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch broadcasts',
      error: error.message
    });
  }
});

/**
 * GET /broadcast/email/:broadcastId
 * Get single broadcast details
 */
router.get('/:broadcastId', auth, async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Get broadcast details'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    const { broadcastId } = req.params;

    const [broadcasts] = await pool.query(
      'SELECT * FROM email_broadcasts WHERE broadcast_id = ?',
      [broadcastId]
    );

    if (broadcasts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    const broadcast = {
      ...broadcasts[0],
      recipient_filter: broadcasts[0].recipient_filter ? JSON.parse(broadcasts[0].recipient_filter) : {},
      attachment_urls: broadcasts[0].attachment_urls ? JSON.parse(broadcasts[0].attachment_urls) : []
    };

    res.json({
      success: true,
      data: broadcast
    });
  } catch (error) {
    console.error('Error fetching broadcast:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch broadcast',
      error: error.message
    });
  }
});

/**
 * GET /broadcast/email/:broadcastId/report
 * Get broadcast report and stats
 */
router.get('/:broadcastId/report', auth, async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Get broadcast report and stats'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    const { broadcastId } = req.params;

    // Get broadcast details
    const [broadcasts] = await pool.query(
      'SELECT * FROM email_broadcasts WHERE broadcast_id = ?',
      [broadcastId]
    );

    if (broadcasts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    const broadcast = broadcasts[0];

    // Get batch stats
    const [batches] = await pool.query(
      'SELECT batch_number, batch_size, sent_count, failed_count, status, processing_time_ms, start_time, end_time FROM email_broadcast_batches WHERE broadcast_id = ? ORDER BY batch_number',
      [broadcastId]
    );

    // Get status breakdown
    const [statusStats] = await pool.query(
      'SELECT status, COUNT(*) as count FROM email_broadcast_logs WHERE broadcast_id = ? GROUP BY status',
      [broadcastId]
    );

    // Get recent logs (last 100)
    const [recentLogs] = await pool.query(
      'SELECT recipient_email, recipient_name, status, error_message, sent_at, retry_count FROM email_broadcast_logs WHERE broadcast_id = ? ORDER BY created_at DESC LIMIT 100',
      [broadcastId]
    );

    const report = {
      broadcast: {
        broadcast_id: broadcast.broadcast_id,
        name: broadcast.name,
        subject: broadcast.subject,
        status: broadcast.status,
        recipient_type: broadcast.recipient_type,
        batch_size: broadcast.batch_size,
        batch_delay_seconds: broadcast.batch_delay_seconds,
        created_at: broadcast.created_at,
        created_by: broadcast.created_by
      },
      stats: {
        total_recipients: broadcast.total_recipients,
        queued_count: broadcast.queued_count,
        sent_count: broadcast.sent_count,
        failed_count: broadcast.failed_count,
        bounced_count: broadcast.bounced_count,
        start_time: broadcast.start_time,
        end_time: broadcast.end_time,
        duration_seconds: broadcast.duration_seconds
      },
      status_breakdown: statusStats.reduce((acc, item) => {
        acc[item.status] = item.count;
        return acc;
      }, {}),
      batches,
      recent_logs: recentLogs
    };

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch broadcast report',
      error: error.message
    });
  }
});

/**
 * GET /broadcast/email/:broadcastId/batches
 * Get all batches for a broadcast
 */
router.get('/:broadcastId/batches', auth, async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Get broadcast batches'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    const { broadcastId } = req.params;

    const [batches] = await pool.query(
      'SELECT * FROM email_broadcast_batches WHERE broadcast_id = ? ORDER BY batch_number',
      [broadcastId]
    );

    res.json({
      success: true,
      data: batches
    });
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch batches',
      error: error.message
    });
  }
});

/**
 * GET /broadcast/email/:broadcastId/logs
 * Get logs for a broadcast with pagination
 */
router.get('/:broadcastId/logs', auth, async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Get broadcast logs'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    const { broadcastId } = req.params;
    const { status, limit = 100, offset = 0 } = req.query;

    let query = 'SELECT * FROM email_broadcast_logs WHERE broadcast_id = ?';
    const params = [broadcastId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [logs] = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM email_broadcast_logs WHERE broadcast_id = ?';
    const countParams = [broadcastId];
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    const [countResult] = await pool.query(countQuery, countParams);

    res.json({
      success: true,
      data: {
        logs,
        total: countResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch logs',
      error: error.message
    });
  }
});

/**
 * GET /broadcast/email/:broadcastId/export
 * Export broadcast report as CSV
 */
router.get('/:broadcastId/export', auth, async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Export broadcast report as CSV'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    const { broadcastId } = req.params;

    const [logs] = await pool.query(
      'SELECT recipient_email, recipient_name, status, error_message, sent_at, retry_count, created_at FROM email_broadcast_logs WHERE broadcast_id = ? ORDER BY created_at',
      [broadcastId]
    );

    if (logs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No logs found for this broadcast'
      });
    }

    // Convert to CSV
    const headers = ['Email', 'Name', 'Status', 'Error Message', 'Sent At', 'Retry Count', 'Created At'];
    const rows = logs.map(log => [
      log.recipient_email,
      log.recipient_name || '',
      log.status,
      log.error_message || '',
      log.sent_at || '',
      log.retry_count,
      log.created_at
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="broadcast-${broadcastId}-report.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export report',
      error: error.message
    });
  }
});

/**
 * GET /broadcast/email/queue/status
 * Get queue status
 */
router.get('/queue/status', auth, async (req, res) => {
  // #swagger.tags = ['Email Broadcast']
  // #swagger.summary = 'Get queue status'
  // #swagger.security = [{ "bearerAuth": [] }]
  try {
    const status = EmailBroadcastQueue.getStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error fetching queue status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch queue status',
      error: error.message
    });
  }
});

export default router;

