import assert from 'node:assert/strict';
import test from 'node:test';
import type { AsnOrder } from '../types/wms';
import {
  canCrossNavigateStage,
  getCrossDepartmentQueueCounts,
  getDepartmentAsns,
  isNavAllowedForRole,
  resolveNavForRole,
} from './roleAccess';

test('segregation of duties strictly isolates Procurement, Warehouse, and IQC navigation', () => {
  // Warehouse CANNOT access Procurement ASN creation or IQC quality inspection
  assert.equal(isNavAllowedForRole('WAREHOUSE', 'asnPlan'), false);
  assert.equal(isNavAllowedForRole('WAREHOUSE', 'asnIqc'), false);
  assert.equal(isNavAllowedForRole('WAREHOUSE', 'asnArrival'), true);
  assert.equal(isNavAllowedForRole('WAREHOUSE', 'asnReceive'), true);
  assert.equal(isNavAllowedForRole('WAREHOUSE', 'asnPutaway'), true);
  assert.equal(isNavAllowedForRole('WAREHOUSE', 'pdaHome'), true);

  // IQC CANNOT access Warehouse receiving/putaway/picking or Procurement ASN creation
  assert.equal(isNavAllowedForRole('IQC', 'asnIqc'), true);
  assert.equal(isNavAllowedForRole('IQC', 'trace'), true);
  assert.equal(isNavAllowedForRole('IQC', 'asnPlan'), false);
  assert.equal(isNavAllowedForRole('IQC', 'asnReceive'), false);
  assert.equal(isNavAllowedForRole('IQC', 'asnPutaway'), false);
  assert.equal(isNavAllowedForRole('IQC', 'pdaHome'), false);

  // Procurement owns ASN plan and CANNOT access Warehouse receiving/putaway or IQC inspection
  assert.equal(isNavAllowedForRole('PROCUREMENT', 'asnPlan'), true);
  assert.equal(isNavAllowedForRole('PROCUREMENT', 'asnReceive'), false);
  assert.equal(isNavAllowedForRole('PROCUREMENT', 'asnIqc'), false);
  assert.equal(isNavAllowedForRole('PROCUREMENT', 'asnPutaway'), false);
  assert.equal(isNavAllowedForRole('PROCUREMENT', 'pdaHome'), false);
});

test('resolveNavForRole redirects unauthorized routes to each department default workspace', () => {
  assert.equal(resolveNavForRole('WAREHOUSE', 'asnIqc', true), 'pdaHome');
  assert.equal(resolveNavForRole('WAREHOUSE', 'asnPlan', false), 'dashboard');
  assert.equal(resolveNavForRole('IQC', 'asnPutaway', true), 'asnIqc');
  assert.equal(resolveNavForRole('PROCUREMENT', 'asnReceive', false), 'asnPlan');
});

test('canCrossNavigateStage permits intra-warehouse arrival<->receive only and forbids Warehouse<->IQC jumps', () => {
  assert.equal(canCrossNavigateStage('arrival', 'RECEIVING'), true);
  assert.equal(canCrossNavigateStage('receive', 'ASN_REGISTERED'), true);

  // Cross-department jumps MUST be forbidden
  assert.equal(canCrossNavigateStage('receive', 'IQC_INSPECTION'), false);
  assert.equal(canCrossNavigateStage('receive', 'PUTAWAY'), false);
  assert.equal(canCrossNavigateStage('iqc', 'PUTAWAY'), false);
  assert.equal(canCrossNavigateStage('iqc', 'RECEIVING'), false);
  assert.equal(canCrossNavigateStage('putaway', 'IQC_INSPECTION'), false);
  assert.equal(canCrossNavigateStage('putaway', 'RECEIVING'), false);
});

test('getDepartmentAsns scopes IQC strictly to notified/inspected lots and Putaway strictly to IQC-released qualified lots', () => {
  const makeAsn = (
    asnNo: string,
    stage: AsnOrder['workflowStage'],
    opts?: { iqcPassedQty?: number; iqcRejectedQty?: number; receivedQty?: number; putawayQty?: number }
  ): AsnOrder => ({
    asnNo,
    poNo: `PO-${asnNo}`,
    supplierCode: 'SUP-01',
    supplierName: '艾睿电子',
    warehouseCode: 'WH-SMT-01',
    expectedDate: '2026-11-18',
    purchaser: '林采购',
    source: 'MANUAL',
    status: stage === 'INFO_SYNCED' ? 'COMPLETED' : 'PARTIAL',
    workflowStage: stage,
    createdAt: '2026-11-17T08:00:00.000Z',
    lines: [
      {
        lineId: `${asnNo}-L1`,
        skuCode: 'MAT-MCU-001',
        mpn: 'STM32F407VET6',
        expectedQty: 500,
        receivedQty: opts?.receivedQty ?? 500,
        iqcPassedQty: opts?.iqcPassedQty ?? 0,
        iqcRejectedQty: opts?.iqcRejectedQty ?? 0,
        putawayQty: opts?.putawayQty ?? 0,
      },
    ],
  });

  const asns: AsnOrder[] = [
    makeAsn('ASN-ARR', 'ASN_REGISTERED', { receivedQty: 0 }),
    makeAsn('ASN-RCV', 'RECEIVING', { receivedQty: 200 }),
    makeAsn('ASN-IQC', 'IQC_INSPECTION', { receivedQty: 500 }),
    makeAsn('ASN-PUT', 'PUTAWAY', { receivedQty: 500, iqcPassedQty: 500 }),
    makeAsn('ASN-REJ', 'INFO_SYNCED', { receivedQty: 500, iqcPassedQty: 0, iqcRejectedQty: 500 }),
    makeAsn('ASN-DONE', 'INFO_SYNCED', { receivedQty: 500, iqcPassedQty: 500, putawayQty: 500 }),
  ];

  // IQC queue excludes unreceived ASNs (ASN-ARR, ASN-RCV) and prioritizes ASN-IQC
  const iqcQueue = getDepartmentAsns(asns, 'iqc').map((a) => a.asnNo);
  assert.equal(iqcQueue[0], 'ASN-IQC');
  assert.equal(iqcQueue.includes('ASN-ARR'), false);
  assert.equal(iqcQueue.includes('ASN-RCV'), false);

  // Putaway queue excludes uninspected ASNs AND 100% IQC-rejected ASNs, prioritizing ASN-PUT
  const putawayQueue = getDepartmentAsns(asns, 'putaway').map((a) => a.asnNo);
  assert.deepEqual(putawayQueue, ['ASN-PUT', 'ASN-DONE']);

  // Warehouse receiving list prioritizes RECEIVING, then ARRIVAL, then read-only notified IQC
  const receiveQueue = getDepartmentAsns(asns, 'receive').map((a) => a.asnNo);
  assert.deepEqual(receiveQueue, ['ASN-RCV', 'ASN-ARR', 'ASN-IQC']);

  // Queue counts match exact departmental workload
  const counts = getCrossDepartmentQueueCounts(asns);
  assert.deepEqual(counts, {
    pendingArrivalCount: 1,
    pendingReceiveCount: 1,
    notifiedIqcCount: 1,
    iqcReleasedPutawayCount: 1,
  });
});
