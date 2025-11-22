import nodemailer from 'nodemailer';
import { EmailData } from '../types';

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Send email
   */
  async sendEmail(data: EmailData): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.FROM_EMAIL,
        to: data.to,
        subject: data.subject,
        html: data.html,
        text: data.text
      });
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new Error('Failed to send email');
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, data: { firstName: string; resetUrl: string }): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f4f4f4; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #007bff; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 20px 0;
          }
          .footer { background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Martial Arts CRM</h1>
          </div>
          <div class="content">
            <h2>Password Reset Request</h2>
            <p>Hello ${data.firstName},</p>
            <p>You have requested to reset your password. Click the button below to reset your password:</p>
            <a href="${data.resetUrl}" class="button">Reset Password</a>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p>${data.resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this password reset, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2024 Martial Arts CRM. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Password Reset Request
      
      Hello ${data.firstName},
      
      You have requested to reset your password. Click the link below to reset your password:
      
      ${data.resetUrl}
      
      This link will expire in 1 hour.
      
      If you didn't request this password reset, please ignore this email.
      
      © 2024 Martial Arts CRM. All rights reserved.
    `;

    await this.sendEmail({
      to: email,
      subject: 'Password Reset Request - Martial Arts CRM',
      html,
      text
    });
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email: string, data: { firstName: string; tenantName: string; loginUrl: string }): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to Martial Arts CRM</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f4f4f4; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #007bff; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 20px 0;
          }
          .footer { background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Martial Arts CRM</h1>
          </div>
          <div class="content">
            <h2>Welcome to Martial Arts CRM!</h2>
            <p>Hello ${data.firstName},</p>
            <p>Welcome to ${data.tenantName}! Your account has been successfully created.</p>
            <p>You can now access your CRM system and start managing your martial arts school.</p>
            <a href="${data.loginUrl}" class="button">Login to Your Account</a>
            <p>If you have any questions, please don't hesitate to contact our support team.</p>
          </div>
          <div class="footer">
            <p>© 2024 Martial Arts CRM. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Welcome to Martial Arts CRM!
      
      Hello ${data.firstName},
      
      Welcome to ${data.tenantName}! Your account has been successfully created.
      
      You can now access your CRM system and start managing your martial arts school.
      
      Login: ${data.loginUrl}
      
      If you have any questions, please don't hesitate to contact our support team.
      
      © 2024 Martial Arts CRM. All rights reserved.
    `;

    await this.sendEmail({
      to: email,
      subject: 'Welcome to Martial Arts CRM',
      html,
      text
    });
  }

  /**
   * Send notification email
   */
  async sendNotificationEmail(email: string, data: { 
    firstName: string; 
    subject: string; 
    message: string; 
    actionUrl?: string;
    actionText?: string;
  }): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${data.subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f4f4f4; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #007bff; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 20px 0;
          }
          .footer { background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Martial Arts CRM</h1>
          </div>
          <div class="content">
            <h2>${data.subject}</h2>
            <p>Hello ${data.firstName},</p>
            <p>${data.message}</p>
            ${data.actionUrl && data.actionText ? `<a href="${data.actionUrl}" class="button">${data.actionText}</a>` : ''}
          </div>
          <div class="footer">
            <p>© 2024 Martial Arts CRM. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      ${data.subject}
      
      Hello ${data.firstName},
      
      ${data.message}
      
      ${data.actionUrl ? `Action: ${data.actionUrl}` : ''}
      
      © 2024 Martial Arts CRM. All rights reserved.
    `;

    await this.sendEmail({
      to: email,
      subject: data.subject,
      html,
      text
    });
  }
}

export const emailService = new EmailService();
