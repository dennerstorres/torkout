import nodemailer from 'nodemailer';

export type AccountEmailKind = 'password-reset' | 'verification';

export interface AccountEmail {
  kind: AccountEmailKind;
  to: string;
  url: string;
}

export interface EmailSender {
  send(message: AccountEmail): Promise<void>;
}

export interface SmtpConfiguration {
  from: string;
  host: string;
  password: string;
  port: number;
  secure: boolean;
  user: string;
}

interface MailTransport {
  sendMail(message: { from: string; subject: string; text: string; to: string }): Promise<unknown>;
}

type TransportFactory = (configuration: {
  auth: { pass: string; user: string };
  host: string;
  port: number;
  secure: boolean;
}) => MailTransport;

const defaultTransportFactory: TransportFactory = (configuration) =>
  nodemailer.createTransport(configuration);

export function createSmtpEmailSender(
  configuration: SmtpConfiguration,
  createTransport: TransportFactory = defaultTransportFactory,
): EmailSender {
  const transport = createTransport({
    auth: { pass: configuration.password, user: configuration.user },
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
  });
  return {
    async send(message) {
      const verification = message.kind === 'verification';
      await transport.sendMail({
        from: configuration.from,
        subject: verification ? 'Confirme seu e-mail no Torkout' : 'Redefina sua senha no Torkout',
        text: verification
          ? `Confirme seu e-mail abrindo este link: ${message.url}\n\nSe você não criou esta conta, ignore esta mensagem.`
          : `Redefina sua senha abrindo este link: ${message.url}\n\nSe você não solicitou a alteração, ignore esta mensagem.`,
        to: message.to,
      });
    },
  };
}
