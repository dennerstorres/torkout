import { describe, expect, it, vi } from 'vitest';

import { createSmtpEmailSender } from './email.js';

describe('SMTP account email', () => {
  it('sends a text-only verification message through the configured transport', async () => {
    const sendMail = vi.fn(async () => ({ messageId: 'test-message' }));
    const sender = createSmtpEmailSender(
      {
        from: 'Torkout <no-reply@example.invalid>',
        host: 'smtp.example.invalid',
        password: 'smtp-password',
        port: 587,
        secure: false,
        user: 'smtp-user',
      },
      () => ({ sendMail }),
    );

    await sender.send({
      kind: 'verification',
      to: 'person@example.invalid',
      url: 'https://torkout.example.test/auth/verify-email?token=secret-token',
    });

    expect(sendMail).toHaveBeenCalledWith({
      from: 'Torkout <no-reply@example.invalid>',
      subject: 'Confirme seu e-mail no Torkout',
      text: expect.stringContaining('https://torkout.example.test/auth/verify-email'),
      to: 'person@example.invalid',
    });
  });
});
