import { describe, expect, test } from 'vitest';
import { InMemoryEmailSender } from '@/lib/email/in-memory';

describe('InMemoryEmailSender', () => {
  test('send stocke le message', async () => {
    const sender = new InMemoryEmailSender();
    await sender.send({ to: 'a@test.com', subject: 'Hi', html: '<p>Hi</p>' });
    expect(sender.inbox('a@test.com')).toHaveLength(1);
  });

  test('inbox filtre par destinataire', async () => {
    const sender = new InMemoryEmailSender();
    await sender.send({ to: 'a@test.com', subject: 'A', html: '<p>A</p>' });
    await sender.send({ to: 'b@test.com', subject: 'B', html: '<p>B</p>' });
    expect(sender.inbox('a@test.com')).toHaveLength(1);
    expect(sender.inbox('a@test.com')[0]?.subject).toBe('A');
  });

  test("clear vide l'inbox", async () => {
    const sender = new InMemoryEmailSender();
    await sender.send({ to: 'a@test.com', subject: 'Hi', html: '<p>Hi</p>' });
    sender.clear();
    expect(sender.inbox('a@test.com')).toHaveLength(0);
  });
});
