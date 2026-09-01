//Unit test 2: password reset
describe.skip('Auth Password Reset', () => {
  // this suite will be skipped
  import AuditLog from '../models/AuditLog';

    test('Logs password reset actions correctly', async () => {
    const log = new AuditLog({ action: 'password-reset-request', details: 'User requested reset' });
    await log.validate();
    expect(log.action).toBe('password-reset-request');
    });

    test('Rejects invalid actions', async () => {
    const log = new AuditLog({ action: 'invalid-action' });
    await expect(log.validate()).rejects.toThrow();
    });
});
