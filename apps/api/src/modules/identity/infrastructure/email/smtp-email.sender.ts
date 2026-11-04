// Adaptador SMTP real (nodemailer). I1: se activa con SMTP_URL.
// Conexión perezosa: createTransport no conecta hasta el primer send.
import { createTransport, Transporter } from 'nodemailer';
import { EmailMessage, EmailSender } from '../../application/ports';

export class SmtpEmailSender implements EmailSender {
  private tx: Transporter | null = null;

  constructor(
    private readonly smtpUrl: string,
    private readonly from: string,
  ) {}

  async send(m: EmailMessage): Promise<void> {
    if (!this.tx) this.tx = createTransport(this.smtpUrl);
    await this.tx.sendMail({ from: this.from, to: m.to, subject: m.subject, text: m.text });
  }
}
