import { ethers } from 'ethers';

/**
 * Polls the network for a transaction receipt with retries and exception handling.
 * This is designed to survive transient RPC node timeouts and network jitters.
 * 
 * @param provider - Ethers provider
 * @param txHash - The transaction hash to wait for
 * @param maxRetries - Maximum number of polling attempts
 * @param intervalMs - Polling interval in milliseconds
 */
export async function waitForTransactionReceiptWithRetry(
  provider: ethers.Provider,
  txHash: string,
  maxRetries = 15,
  intervalMs = 2500
): Promise<ethers.TransactionReceipt> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        return receipt;
      }
    } catch (err: any) {
      console.warn(`Attempt ${i + 1} to fetch receipt for ${txHash} failed:`, err.message || err);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Transaction confirmation timed out after ${maxRetries} attempts. Please check Blockscout explorer for tx: ${txHash}`);
}
