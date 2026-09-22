import { test, expect } from '@playwright/test';
import {
  Asset,
  BASE_FEE,
  Keypair,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

import { buildVaquitaClaimTransaction } from '../../src/lib/claim';
import {
  buildDonationTransaction,
  fundIfMissing,
} from '../../src/lib/donate';
import { getServer, NETWORK } from '../../src/lib/stellar';

const runTestnet = process.env.RUN_STELLAR_TESTNET_E2E === '1';

test.describe('Vaquita aid loop on Stellar Testnet', () => {
  test.skip(!runTestnet, 'Set RUN_STELLAR_TESTNET_E2E=1 to use Testnet');

  test('donates, emits a claimable balance, and claims it', async () => {
    const server = getServer();
    const donor = Keypair.random();
    const pool = Keypair.random();
    const receiver = Keypair.random();
    const incidentId = `e2e-${Date.now().toString(36)}`;

    await Promise.all(
      [donor, pool, receiver].map((account) =>
        fundIfMissing(account.publicKey()),
      ),
    );

    const donorAccount = await server.loadAccount(donor.publicKey());
    const donation = buildDonationTransaction(
      donorAccount,
      pool.publicKey(),
      '2',
      incidentId,
    );
    donation.sign(donor);
    const donationResponse = await server.submitTransaction(donation);

    const poolAccount = await server.loadAccount(pool.publicKey());
    const emission = buildVaquitaClaimTransaction(
      poolAccount,
      receiver.publicKey(),
      '1',
      incidentId,
    );
    const balanceId = emission.getClaimableBalanceId(0);
    emission.sign(pool);
    const emissionResponse = await server.submitTransaction(emission);

    const balance = await server
      .claimableBalances()
      .claimableBalance(balanceId)
      .call();
    expect(balance.amount).toBe('1.0000000');
    expect(balance.asset).toBe(Asset.native().toString());
    expect(balance.claimants.map((claimant) => claimant.destination)).toContain(
      receiver.publicKey(),
    );

    const receiverAccount = await server.loadAccount(receiver.publicKey());
    const claim = new TransactionBuilder(receiverAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK,
    })
      .addOperation(Operation.claimClaimableBalance({ balanceId }))
      .setTimeout(180)
      .build();
    claim.sign(receiver);
    const claimResponse = await server.submitTransaction(claim);

    const claimOperations = await server
      .operations()
      .forTransaction(claimResponse.hash)
      .call();
    expect(claimOperations.records).toHaveLength(1);
    expect(claimOperations.records[0].type).toBe('claim_claimable_balance');

    console.log(
      `AID_LOOP_RECEIPT=${JSON.stringify({
        incidentId,
        balanceId,
        donor: donor.publicKey(),
        pool: pool.publicKey(),
        receiver: receiver.publicKey(),
        donationTxHash: donationResponse.hash,
        emissionTxHash: emissionResponse.hash,
        claimTxHash: claimResponse.hash,
      })}`,
    );
  });
});
