import nodemailer from 'nodemailer';
import { EmailData } from '../types';

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
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
        <title>Сброс пароля</title>
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
            <h2>Сброс пароля</h2>
            <p>Здравствуйте${data.firstName ? `, ${data.firstName}` : ''}!</p>
            <p>Вы запросили сброс пароля. Нажмите кнопку ниже:</p>
            <a href="${data.resetUrl}" class="button">Сбросить пароль</a>
            <p>Если кнопка не работает, скопируйте ссылку в браузер:</p>
            <p>${data.resetUrl}</p>
            <p>Ссылка действительна 1 час.</p>
            <p>Если вы не запрашивали сброс, просто проигнорируйте это письмо.</p>
          </div>
          <div class="footer">
            <p>© Martial Arts CRM</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Сброс пароля
      
      Здравствуйте${data.firstName ? `, ${data.firstName}` : ''}!
      
      Ссылка для сброса пароля: ${data.resetUrl}
      
      Ссылка действительна 1 час.
    `;

    await this.sendEmail({
      to: email,
      subject: 'Сброс пароля — Martial Arts CRM',
      html,
      text
    });
  }

  /** Письмо с 6-значным кодом для сброса пароля. */
  async sendPasswordResetCodeEmail(
    email: string,
    data: { firstName?: string; code: string }
  ): Promise<void> {
    const name = data.firstName ? `, ${data.firstName}` : '';
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Код сброса пароля</title></head>
      <body style="font-family:Arial,sans-serif;line-height:1.6;color:#333">
        <div style="max-width:560px;margin:0 auto;padding:24px">
          <h2>Сброс пароля</h2>
          <p>Здравствуйте${name}!</p>
          <p>Ваш код для сброса пароля:</p>
          <p style="font-size:32px;font-weight:700;letter-spacing:6px">${data.code}</p>
          <p>Код действует 10 минут. Если вы не запрашивали сброс — проигнорируйте письмо.</p>
        </div>
      </body>
      </html>
    `;
    const text = `Здравствуйте${name}!\n\nКод для сброса пароля: ${data.code}\nДействует 10 минут.`;
    await this.sendEmail({
      to: email,
      subject: 'Код сброса пароля — Martial Arts CRM',
      html,
      text,
    });
  }

  /** Письмо с 6-значным кодом подтверждения email. */
  async sendVerificationCodeEmail(
    email: string,
    data: { firstName?: string; code: string }
  ): Promise<void> {
    const name = data.firstName ? `, ${data.firstName}` : '';
    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Подтверждение email</title></head>
      <body style="font-family:Arial,sans-serif;line-height:1.6;color:#333">
        <div style="max-width:560px;margin:0 auto;padding:24px">
          <h2>Подтверждение email</h2>
          <p>Здравствуйте${name}!</p>
          <p>Ваш код подтверждения:</p>
          <p style="font-size:32px;font-weight:700;letter-spacing:6px">${data.code}</p>
          <p>Код действует 10 минут. Подтверждение почты необязательно для входа.</p>
        </div>
      </body>
      </html>
    `;
    const text = `Здравствуйте${name}!\n\nКод подтверждения email: ${data.code}\nДействует 10 минут.`;
    await this.sendEmail({
      to: email,
      subject: 'Подтверждение email — Martial Arts CRM',
      html,
      text,
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

  /**
   * Send parent registration confirmation email
   */
  async sendParentConfirmationEmail(
    email: string, 
    data: { 
      parentName: string; 
      childName: string; 
      tenantName: string; 
      confirmationUrl: string 
    }
  ): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Подтверждение регистрации</title>
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
            <h1>${data.tenantName}</h1>
          </div>
          <div class="content">
            <h2>Подтверждение регистрации</h2>
            <p>Здравствуйте, ${data.parentName}!</p>
            <p>Вы были добавлены как родитель клиента <strong>${data.childName}</strong> в системе ${data.tenantName}.</p>
            <p>Для подтверждения регистрации и активации вашего доступа к информации о ребенке, пожалуйста, нажмите на кнопку ниже:</p>
            <a href="${data.confirmationUrl}" class="button">Подтвердить регистрацию</a>
            <p>Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:</p>
            <p>${data.confirmationUrl}</p>
            <p>Ссылка действительна в течение 7 дней.</p>
            <p>Если вы не ожидали это письмо, пожалуйста, проигнорируйте его.</p>
          </div>
          <div class="footer">
            <p>© 2024 Martial Arts CRM. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Подтверждение регистрации
      
      Здравствуйте, ${data.parentName}!
      
      Вы были добавлены как родитель клиента ${data.childName} в системе ${data.tenantName}.
      
      Для подтверждения регистрации перейдите по ссылке:
      ${data.confirmationUrl}
      
      Ссылка действительна в течение 7 дней.
      
      Если вы не ожидали это письмо, пожалуйста, проигнорируйте его.
      
      © 2024 Martial Arts CRM. All rights reserved.
    `;

    await this.sendEmail({
      to: email,
      subject: `Подтверждение регистрации - ${data.tenantName}`,
      html,
      text
    });
  }
}

export const emailService = new EmailService();
