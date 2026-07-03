export function getVisibleText(el: HTMLElement): string {
  return (el.innerText || el.textContent || "").trim();
}

export function isVisible(el: HTMLElement): boolean {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

export function findElementByTextFallback(root: ParentNode, selector: string, texts: string[]): HTMLElement | null {
  const elements = Array.from(root.querySelectorAll(selector)) as HTMLElement[];
  for (const el of elements) {
    if (!isVisible(el)) continue;
    const text = getVisibleText(el).toLowerCase();
    for (const matchText of texts) {
      if (text.includes(matchText.toLowerCase())) {
        return el;
      }
    }
  }
  return null;
}

export function findMenuItemByText(root: ParentNode, texts: string[]): HTMLElement | null {
  // First try data attributes, role attributes, then generic divs/buttons
  return findElementByTextFallback(root, '[role="menuitem"], menuitem, button, div', texts);
}

export function findButtonByText(root: ParentNode, texts: string[]): HTMLElement | null {
  return findElementByTextFallback(root, 'button, [role="button"]', texts);
}
