import { test, expect } from '@playwright/test';
import { Account, Keypair } from '@stellar/stellar-sdk';

import {
  buildDonationTransaction,
  vaquitaMemoFor,
} from '../../src/lib/donate';
import { buildVaquitaClaimTransaction } from '../../src/lib/claim';

function account(sequence = '1'): Account {
  return new Account(Keypair.random().publicKey(), sequence);
}

test.describe('Vaquita Stellar contracts', () => {
  test('builds a native XLM donation bound to the incident memo', () => {
    const pool = Keypair.random().publicKey();
    const transaction = buildDonationTransaction(
      account(),
      pool,
      '2.5',
      'incident-1234567890',
    );

    expect(vaquitaMemoFor('incident-1234567890')).toBe('vq:incident');
    expect(transaction.memo.type).toBe('text');
    expect(transaction.memo.value?.toString()).toBe('vq:incident');
    expect(transaction.operations).toHaveLength(1);

    const operation = transaction.operations[0];
    expect(operation.type).toBe('payment');
    if (operation.type !== 'payment') return;
    expect(operation.destination).toBe(pool);
    expect(operation.asset.isNative()).toBe(true);
    expect(operation.amount).toBe('2.5000000');
  });

  test('rejects an unbound donation or non-positive amount', () => {
    const pool = Keypair.random().publicKey();
    expect(() => vaquitaMemoFor('   ')).toThrow('El incidente es obligatorio');
    expect(() =>
      buildDonationTransaction(account(), pool, '0', 'incident-1'),
    ).toThrow();
  });

  test('builds a native claimable balance for the incident reporter', () => {
    const reporter = Keypair.random().publicKey();
    const transaction = buildVaquitaClaimTransaction(
      account(),
      reporter,
      '7.25',
      'incident-1234567890',
    );

    expect(transaction.memo.type).toBe('text');
    expect(transaction.memo.value?.toString()).toBe('vq:incident');
    expect(transaction.operations).toHaveLength(1);

    const operation = transaction.operations[0];
    expect(operation.type).toBe('createClaimableBalance');
    if (operation.type !== 'createClaimableBalance') return;
    expect(operation.asset.isNative()).toBe(true);
    expect(operation.amount).toBe('7.2500000');
    expect(operation.claimants).toHaveLength(1);
    expect(operation.claimants[0].destination).toBe(reporter);
    expect(operation.claimants[0].predicate.switch().name).toBe(
      'claimPredicateUnconditional',
    );
  });
});
