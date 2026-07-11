import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import twilio from 'twilio';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private resendClient: Resend | null = null;
  private twilioClient: twilio.Twilio | null = null;

  private senderEmail: string;
  private twilioPhoneNumber: string;
  private twilioWhatsAppNumber: string;

  constructor(private readonly configService: ConfigService) {
    const emailApiKey = this.configService.get<string>('EMAIL_API_KEY');
    this.senderEmail = this.configService.get<string>('SENDER_EMAIL', 'onboarding@resend.dev');

    if (emailApiKey) {
      this.resendClient = new Resend(emailApiKey);
      this.logger.log('Resend Email Client initialized successfully.');
    } else {
      this.logger.warn('EMAIL_API_KEY is not defined. Email notifications will be mocked.');
    }

    const twilioSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.twilioPhoneNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER', '');
    this.twilioWhatsAppNumber = this.configService.get<string>('TWILIO_WHATSAPP_NUMBER', '+14155238886'); // Twilio default sandbox number

    if (twilioSid && twilioAuthToken) {
      this.twilioClient = twilio(twilioSid, twilioAuthToken);
      this.logger.log('Twilio Client initialized successfully.');
    } else {
      this.logger.warn('TWILIO_ACCOUNT_SID and/or TWILIO_AUTH_TOKEN are not defined. SMS & WhatsApp notifications will be mocked.');
    }
  }

  /**
   * Send a transactional HTML Email using Resend
   */
  async sendEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
    this.logger.log(`Sending email to ${to} with subject: "${subject}"`);
    if (!this.resendClient) {
      this.logger.warn('[MOCKED EMAIL] Resend client not configured.');
      return true;
    }

    try {
      const response = await this.resendClient.emails.send({
        from: this.senderEmail,
        to,
        subject,
        html: htmlContent,
      });

      if (response.error) {
        this.logger.error(`Resend Email Error: ${JSON.stringify(response.error)}`);
        return false;
      }

      this.logger.log(`Email successfully sent to ${to}. ID: ${response.data?.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
      return false;
    }
  }

  /**
   * Send a text message (SMS) using Twilio
   */
  async sendSMS(to: string, body: string): Promise<boolean> {
    this.logger.log(`Sending SMS to ${to}: "${body}"`);
    if (!this.twilioClient || !this.twilioPhoneNumber) {
      this.logger.warn('[MOCKED SMS] Twilio client/phone number not configured.');
      return true;
    }

    try {
      const message = await this.twilioClient.messages.create({
        body,
        from: this.twilioPhoneNumber,
        to,
      });

      this.logger.log(`SMS successfully sent to ${to}. SID: ${message.sid}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${to}: ${error.message}`);
      return false;
    }
  }

  /**
   * Send a WhatsApp message using Twilio WhatsApp API
   */
  async sendWhatsApp(to: string, body: string): Promise<boolean> {
    this.logger.log(`Sending WhatsApp to ${to}: "${body}"`);
    if (!this.twilioClient) {
      this.logger.warn('[MOCKED WHATSAPP] Twilio client not configured.');
      return true;
    }

    try {
      const fromFormatted = this.twilioWhatsAppNumber.startsWith('whatsapp:')
        ? this.twilioWhatsAppNumber
        : `whatsapp:${this.twilioWhatsAppNumber}`;
        
      const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

      const message = await this.twilioClient.messages.create({
        body,
        from: fromFormatted,
        to: toFormatted,
      });

      this.logger.log(`WhatsApp message successfully sent to ${to}. SID: ${message.sid}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp message to ${to}: ${error.message}`);
      return false;
    }
  }
}
