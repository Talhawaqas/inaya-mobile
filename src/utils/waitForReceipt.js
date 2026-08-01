// src/utils/waitForReceipt.js
//
// invokeMethod's eth_sendTransaction only returns a txHash (matches
// MetaMask's raw JSON-RPC response) — unlike ethers' tx.wait(), nothing
// waits for it to actually mine. Needed wherever one transaction's result
// (e.g. an ERC20 approve) must be confirmed on-chain before submitting the
// next one (e.g. stake), or it can revert against the still-zero allowance.

export async function waitForReceipt(invokeMethod, txHash, { intervalMs = 2000, timeoutMs = 90000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const receipt = await invokeMethod({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    });
    if (receipt) return receipt;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for transaction ${txHash.slice(0, 14)}... to confirm.`);
}
