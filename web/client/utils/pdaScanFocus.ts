import type { RefObject } from 'react';

export type ScanOutcome = 'success' | 'error';

export interface ScanPostAction {
  nextValue: string;
  shouldFocus: boolean;
  shouldSelectAll: boolean;
}

/**
 * Pure decision function for standard MES/PDA post-scan input behavior:
 * - On business success: clear input value and focus for the next scan.
 * - On business failure: retain the last scanned value, focus, and select all
 *   so the next hardware scanner trigger overwrites it with zero manual UI intervention.
 */
export function computeScanPostAction(
  currentValue: string,
  outcome: ScanOutcome
): ScanPostAction {
  if (outcome === 'success') {
    return {
      nextValue: '',
      shouldFocus: true,
      shouldSelectAll: false,
    };
  }
  return {
    nextValue: currentValue,
    shouldFocus: true,
    shouldSelectAll: true,
  };
}

/**
 * Applies DOM focus (and select-all on error) to a scan input element.
 * Safe to invoke in both browser and non-DOM/test environments.
 */
export function applyScanFocusToElement(
  input: HTMLInputElement | null,
  outcome: ScanOutcome
): void {
  if (!input || input.disabled) return;
  if (typeof input.scrollIntoView === 'function') {
    input.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  input.focus();
  if (outcome === 'error') {
    input.select();
    try {
      input.setSelectionRange(0, input.value.length);
    } catch {
      // Some input types do not support setSelectionRange; input.select() already ran.
    }
  }
}

/**
 * Schedules post-scan focus/selection after React commits state updates and
 * re-enables any temporarily busy/disabled controls.
 */
export function scheduleScanInputFocus(
  inputRef: RefObject<HTMLInputElement | null>,
  outcome: ScanOutcome
): void {
  const run = () => applyScanFocusToElement(inputRef.current, outcome);
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      window.setTimeout(run, 30);
    });
  } else {
    setTimeout(run, 30);
  }
}

/**
 * Focuses a scan input on page/stage entry. If the field is pre-populated with
 * a default value, selects the existing text so a hardware scanner immediately
 * replaces it instead of concatenating onto the default value.
 */
export function focusScanInputOnMount(inputRef: RefObject<HTMLInputElement | null>): void {
  const run = () => {
    const el = inputRef.current;
    if (!el || el.disabled) return;
    el.focus();
    if (el.value.length > 0) {
      el.select();
      try {
        el.setSelectionRange(0, el.value.length);
      } catch {
        // Ignore unsupported input types
      }
    }
  };
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      window.setTimeout(run, 40);
    });
  } else {
    setTimeout(run, 40);
  }
}

/**
 * Atomic helper enforcing the standard MES/PDA post-scan lifecycle:
 * - success -> clear input + auto-focus
 * - error   -> keep input value + auto-focus + select-all
 */
export function completePdaScan(params: {
  currentValue: string;
  setValue: (next: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  outcome: ScanOutcome;
}): ScanPostAction {
  const action = computeScanPostAction(params.currentValue, params.outcome);
  if (action.nextValue !== params.currentValue) {
    params.setValue(action.nextValue);
  }
  if (action.shouldFocus) {
    scheduleScanInputFocus(params.inputRef, params.outcome);
  }
  return action;
}
