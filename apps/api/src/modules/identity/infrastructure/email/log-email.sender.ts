// Adaptador de correo para local: registra por consola (sin SMTP).
// El adaptador SMTP real implementará el mismo puerto (Fase G/post-MVP).
import { EmailMessage, EmailSender } from '../../application/ports';

export class LogEmailSender implements EmailSender {
  async send(m: EmailMessage): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[email] to=${m.to} subject=${m.subject}\n${m.text}`);
  }
}
