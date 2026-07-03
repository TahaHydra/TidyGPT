import { Selectors } from '../selectors/chatgpt-selectors';

export async function waitForStableDom(timeoutMs = 5000, stabilizeTimeMs = 1500): Promise<boolean> {
  // Mock implementation for extension environment
  // Will observe DOM mutations and resolve when idle for stabilizeTimeMs
  return new Promise((resolve) => {
    let timeout: ReturnType<typeof setTimeout>;
    let maxWait: ReturnType<typeof setTimeout>;

    const observer = new MutationObserver(() => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        observer.disconnect();
        clearTimeout(maxWait);
        resolve(true);
      }, stabilizeTimeMs);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    maxWait = setTimeout(() => {
      observer.disconnect();
      clearTimeout(timeout);
      resolve(false);
    }, timeoutMs);

    timeout = setTimeout(() => {
      observer.disconnect();
      clearTimeout(maxWait);
      resolve(true);
    }, stabilizeTimeMs);
  });
}
