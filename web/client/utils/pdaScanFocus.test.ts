import assert from 'node:assert/strict';
import test from 'node:test';
import { applyScanFocusToElement, computeScanPostAction } from './pdaScanFocus.ts';

test('computeScanPostAction clears value and requests focus without select-all on success', () => {
  const action = computeScanPostAction('P:STM32F407VET6|Q:500', 'success');
  assert.deepEqual(action, {
    nextValue: '',
    shouldFocus: true,
    shouldSelectAll: false,
  });
});

test('computeScanPostAction preserves value and requests focus + select-all on error', () => {
  const action = computeScanPostAction('BAD-BARCODE-999', 'error');
  assert.deepEqual(action, {
    nextValue: 'BAD-BARCODE-999',
    shouldFocus: true,
    shouldSelectAll: true,
  });
});

test('applyScanFocusToElement scrolls into view, calls focus on success, and focus + select + setSelectionRange on error', () => {
  const calls: string[] = [];
  const fakeInput = {
    disabled: false,
    value: 'RL261015-999',
    scrollIntoView: () => calls.push('scrollIntoView'),
    focus: () => calls.push('focus'),
    select: () => calls.push('select'),
    setSelectionRange: (start: number, end: number) =>
      calls.push(`range:${start}-${end}`),
  } as unknown as HTMLInputElement;

  applyScanFocusToElement(fakeInput, 'success');
  assert.deepEqual(calls, ['scrollIntoView', 'focus']);

  calls.length = 0;
  applyScanFocusToElement(fakeInput, 'error');
  assert.deepEqual(calls, ['scrollIntoView', 'focus', 'select', 'range:0-12']);
});

test('applyScanFocusToElement safely ignores null or disabled inputs', () => {
  const calls: string[] = [];
  const disabledInput = {
    disabled: true,
    value: 'RL261015-999',
    focus: () => calls.push('focus'),
    select: () => calls.push('select'),
  } as unknown as HTMLInputElement;

  applyScanFocusToElement(null, 'error');
  applyScanFocusToElement(disabledInput, 'error');
  assert.deepEqual(calls, []);
});
