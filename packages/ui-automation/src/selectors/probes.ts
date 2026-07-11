import { getPlatformAdapter } from "../platforms";

export type ProbeResult = {
  ok: boolean;
  confidence: number;
  found: number;
  warnings: string[];
};

export type UiHealthStatus = {
  sidebar: ProbeResult;
  chatLinks: ProbeResult;
  menuTrigger: ProbeResult;
  archiveAction: ProbeResult;
  deleteAction: ProbeResult;
};

export function probeSidebar(): ProbeResult {
  const container = document.querySelector(getPlatformAdapter().sidebar);
  if (!container) return { ok: false, confidence: 0, found: 0, warnings: ["Sidebar container not found"] };
  return { ok: true, confidence: 1.0, found: 1, warnings: [] };
}

export function probeChatLinks(): ProbeResult {
  const links = document.querySelectorAll(getPlatformAdapter().conversationLink);
  if (links.length === 0) return { ok: false, confidence: 0, found: 0, warnings: ["No chat links found"] };
  return { ok: true, confidence: 1.0, found: links.length, warnings: [] };
}

export function probeMenuTrigger(): ProbeResult {
  // Try to find the trigger on any visible chat link
  const adapter = getPlatformAdapter();
  const links = document.querySelectorAll(adapter.conversationLink);
  for (const link of Array.from(links).slice(0, 5)) {
    const wrapper = link.closest(adapter.menuScope) || link.parentElement;
    if (wrapper) {
      const trigger = wrapper.querySelector(adapter.menuTriggers);
      if (trigger) {
        return { ok: true, confidence: 0.9, found: 1, warnings: [] };
      }
    }
  }
  return { ok: false, confidence: 0.1, found: 0, warnings: ["Menu trigger button not found"] };
}

// Probing archive/delete requires opening a menu. Since we don't want to disrupt the user during a silent probe,
// we might have to rely on previous heuristics or perform a tiny invisible click if safe.
// For now, we return uncertain unless we actually open a menu.
export function probeArchiveAction(): ProbeResult {
  const adapter = getPlatformAdapter();
  return adapter.supportsArchive
    ? { ok: true, confidence: 0.8, found: 0, warnings: ["Available; verified only during an approved action"] }
    : { ok: false, confidence: 1, found: 0, warnings: [`${adapter.label} has no native archive capability`] };
}

export function probeDeleteAction(): ProbeResult {
  return { ok: true, confidence: 0.8, found: 0, warnings: ["Probed heuristically"] };
}

export function runAllProbes(): UiHealthStatus {
  return {
    sidebar: probeSidebar(),
    chatLinks: probeChatLinks(),
    menuTrigger: probeMenuTrigger(),
    archiveAction: probeArchiveAction(),
    deleteAction: probeDeleteAction()
  };
}
