import assert from 'node:assert/strict';
import test from 'node:test';
import type { AsnOrder } from '../types/wms';
import {
  canCrossNavigateStage,
  canEditMasterTab,
  canManageUsers,
  canSwitchDepartmentView,
  getCrossDepartmentQueueCounts,
  getDefaultMasterTab,
  getDepartmentAsns,
  isApiRoleAllowed,
  isNavAllowedForRole,
  normalizeUserRole,
  normalizeUserStatus,
  resolveEffectiveDepartmentRole,
  resolveNavForRole,
  validateUserAdminMutation,
  type MasterTabKey,
} from './roleAccess';

test('segregation of duties strictly isolates Procurement, Warehouse, and IQC navigation', () => {
  // Warehouse CANNOT access Procurement ASN creation, IQC quality inspection, or Admin user management
  assert.equal(isNavAllowedForRole('WAREHOUSE', 'asnPlan', 'WAREHOUSE'), false);
  assert.equal(isNavAllowedForRole('WAREHOUSE', 'asnIqc', 'WAREHOUSE'), false);
  assert.equal(isNavAllowedForRole('WAREHOUSE', 'userAdmin', 'WAREHOUSE'), false);
  assert.equal(isNavAllowedForRole('WAREHOUSE', 'asnArrival', 'WAREHOUSE'), true);
  assert.equal(isNavAllowedForRole('WAREHOUSE', 'asnReceive', 'WAREHOUSE'), true);
  assert.equal(isNavAllowedForRole('WAREHOUSE', 'asnPutaway', 'WAREHOUSE'), true);
  assert.equal(isNavAllowedForRole('WAREHOUSE', 'pdaHome', 'WAREHOUSE'), true);

  // IQC CANNOT access Warehouse receiving/putaway/picking, Procurement ASN creation, or Admin panel
  assert.equal(isNavAllowedForRole('IQC', 'asnIqc', 'IQC'), true);
  assert.equal(isNavAllowedForRole('IQC', 'trace', 'IQC'), true);
  assert.equal(isNavAllowedForRole('IQC', 'asnPlan', 'IQC'), false);
  assert.equal(isNavAllowedForRole('IQC', 'asnReceive', 'IQC'), false);
  assert.equal(isNavAllowedForRole('IQC', 'asnPutaway', 'IQC'), false);
  assert.equal(isNavAllowedForRole('IQC', 'pdaHome', 'IQC'), false);
  assert.equal(isNavAllowedForRole('IQC', 'userAdmin', 'IQC'), false);

  // Procurement owns ASN plan and CANNOT access Warehouse, IQC, or Admin panel
  assert.equal(isNavAllowedForRole('PROCUREMENT', 'asnPlan', 'PROCUREMENT'), true);
  assert.equal(isNavAllowedForRole('PROCUREMENT', 'asnReceive', 'PROCUREMENT'), false);
  assert.equal(isNavAllowedForRole('PROCUREMENT', 'asnIqc', 'PROCUREMENT'), false);
  assert.equal(isNavAllowedForRole('PROCUREMENT', 'asnPutaway', 'PROCUREMENT'), false);
  assert.equal(isNavAllowedForRole('PROCUREMENT', 'pdaHome', 'PROCUREMENT'), false);
  assert.equal(isNavAllowedForRole('PROCUREMENT', 'userAdmin', 'PROCUREMENT'), false);

  // Warehouse STILL shares replenish and returnStock with Production
  assert.equal(isNavAllowedForRole('WAREHOUSE', 'replenish', 'WAREHOUSE'), true);
  assert.equal(isNavAllowedForRole('WAREHOUSE', 'returnStock', 'WAREHOUSE'), true);

  // Production shares replenish & returnStock + trace, and CANNOT access Warehouse/IQC/Procurement/Admin
  assert.equal(isNavAllowedForRole('PRODUCTION', 'replenish', 'PRODUCTION'), true);
  assert.equal(isNavAllowedForRole('PRODUCTION', 'returnStock', 'PRODUCTION'), true);
  assert.equal(isNavAllowedForRole('PRODUCTION', 'trace', 'PRODUCTION'), true);
  assert.equal(isNavAllowedForRole('PRODUCTION', 'asnPlan', 'PRODUCTION'), false);
  assert.equal(isNavAllowedForRole('PRODUCTION', 'asnReceive', 'PRODUCTION'), false);
  assert.equal(isNavAllowedForRole('PRODUCTION', 'asnIqc', 'PRODUCTION'), false);
  assert.equal(isNavAllowedForRole('PRODUCTION', 'asnPutaway', 'PRODUCTION'), false);
  assert.equal(isNavAllowedForRole('PRODUCTION', 'wavePick', 'PRODUCTION'), false);
  assert.equal(isNavAllowedForRole('PRODUCTION', 'pdaHome', 'PRODUCTION'), false);
  assert.equal(isNavAllowedForRole('PRODUCTION', 'dashboard', 'PRODUCTION'), false);
  assert.equal(isNavAllowedForRole('PRODUCTION', 'userAdmin', 'PRODUCTION'), false);

  // ADMIN can access userAdmin regardless of active preview department
  assert.equal(isNavAllowedForRole('WAREHOUSE', 'userAdmin', 'ADMIN'), true);
  assert.equal(isNavAllowedForRole('IQC', 'userAdmin', 'ADMIN'), true);
  assert.equal(isNavAllowedForRole('PROCUREMENT', 'userAdmin', 'ADMIN'), true);
  assert.equal(isNavAllowedForRole('PRODUCTION', 'userAdmin', 'ADMIN'), true);
});

test('RBAC role locking enforces switcher & admin access strictly for ADMIN only', () => {
  assert.equal(canSwitchDepartmentView('ADMIN'), true);
  assert.equal(canSwitchDepartmentView('WAREHOUSE'), false);
  assert.equal(canSwitchDepartmentView('IQC'), false);
  assert.equal(canSwitchDepartmentView('PROCUREMENT'), false);
  assert.equal(canSwitchDepartmentView('PRODUCTION'), false);

  assert.equal(canManageUsers('ADMIN'), true);
  assert.equal(canManageUsers('WAREHOUSE'), false);
  assert.equal(canManageUsers('IQC'), false);
  assert.equal(canManageUsers('PROCUREMENT'), false);
  assert.equal(canManageUsers('PRODUCTION'), false);

  // Non-admin staff are strictly locked to their own department regardless of preview value
  assert.equal(resolveEffectiveDepartmentRole('IQC', 'WAREHOUSE'), 'IQC');
  assert.equal(resolveEffectiveDepartmentRole('PROCUREMENT', 'WAREHOUSE'), 'PROCUREMENT');
  assert.equal(resolveEffectiveDepartmentRole('WAREHOUSE', 'IQC'), 'WAREHOUSE');
  assert.equal(resolveEffectiveDepartmentRole('PRODUCTION', 'WAREHOUSE'), 'PRODUCTION');
  // Admin can freely preview any department
  assert.equal(resolveEffectiveDepartmentRole('ADMIN', 'IQC'), 'IQC');
  assert.equal(resolveEffectiveDepartmentRole('ADMIN', 'PROCUREMENT'), 'PROCUREMENT');
  assert.equal(resolveEffectiveDepartmentRole('ADMIN', 'PRODUCTION'), 'PRODUCTION');

  assert.equal(normalizeUserRole('ADMIN'), 'ADMIN');
  assert.equal(normalizeUserRole('PRODUCTION'), 'PRODUCTION');
  assert.equal(normalizeUserRole('UNKNOWN'), 'WAREHOUSE');
  assert.equal(normalizeUserStatus('DISABLED'), 'DISABLED');
  assert.equal(normalizeUserStatus('BAD'), 'ACTIVE');
});

test('API role checks and admin lockout guards prevent unauthorized access and last-admin lockout', () => {
  assert.equal(isApiRoleAllowed('ADMIN', ['PROCUREMENT', 'ADMIN']), true);
  assert.equal(isApiRoleAllowed('PROCUREMENT', ['PROCUREMENT', 'ADMIN']), true);
  assert.equal(isApiRoleAllowed('IQC', ['PROCUREMENT', 'ADMIN']), false);
  assert.equal(isApiRoleAllowed('WAREHOUSE', ['IQC', 'ADMIN']), false);

  // Shared Warehouse + Production endpoints (replenish / production return)
  assert.equal(isApiRoleAllowed('WAREHOUSE', ['WAREHOUSE', 'PRODUCTION', 'ADMIN']), true);
  assert.equal(isApiRoleAllowed('PRODUCTION', ['WAREHOUSE', 'PRODUCTION', 'ADMIN']), true);
  assert.equal(isApiRoleAllowed('ADMIN', ['WAREHOUSE', 'PRODUCTION', 'ADMIN']), true);
  assert.equal(isApiRoleAllowed('IQC', ['WAREHOUSE', 'PRODUCTION', 'ADMIN']), false);
  assert.equal(isApiRoleAllowed('PROCUREMENT', ['WAREHOUSE', 'PRODUCTION', 'ADMIN']), false);
  // Production cannot invoke warehouse-only or procurement-only endpoints
  assert.equal(isApiRoleAllowed('PRODUCTION', ['WAREHOUSE', 'ADMIN']), false);
  assert.equal(isApiRoleAllowed('PRODUCTION', ['PROCUREMENT', 'ADMIN']), false);

  // Cannot disable own admin account
  assert.ok(
    validateUserAdminMutation({
      actorUid: 'u1',
      targetUid: 'u1',
      currentRole: 'ADMIN',
      currentStatus: 'ACTIVE',
      nextRole: 'ADMIN',
      nextStatus: 'DISABLED',
      activeAdminCount: 2,
    })
  );

  // Cannot demote the last active admin
  assert.ok(
    validateUserAdminMutation({
      actorUid: 'u1',
      targetUid: 'u1',
      currentRole: 'ADMIN',
      currentStatus: 'ACTIVE',
      nextRole: 'WAREHOUSE',
      nextStatus: 'ACTIVE',
      activeAdminCount: 1,
    })
  );

  // Can demote an admin when another active admin exists
  assert.equal(
    validateUserAdminMutation({
      actorUid: 'u1',
      targetUid: 'u2',
      currentRole: 'ADMIN',
      currentStatus: 'ACTIVE',
      nextRole: 'IQC',
      nextStatus: 'ACTIVE',
      activeAdminCount: 2,
    }),
    null
  );

  // Can disable a regular staff user
  assert.equal(
    validateUserAdminMutation({
      actorUid: 'u1',
      targetUid: 'u3',
      currentRole: 'WAREHOUSE',
      currentStatus: 'ACTIVE',
      nextRole: 'WAREHOUSE',
      nextStatus: 'DISABLED',
      activeAdminCount: 1,
    }),
    null
  );
});

test('resolveNavForRole redirects unauthorized routes to each department default workspace', () => {
  assert.equal(resolveNavForRole('WAREHOUSE', 'asnIqc', true, 'WAREHOUSE'), 'pdaHome');
  assert.equal(resolveNavForRole('WAREHOUSE', 'asnPlan', false, 'WAREHOUSE'), 'dashboard');
  assert.equal(resolveNavForRole('WAREHOUSE', 'userAdmin', false, 'WAREHOUSE'), 'dashboard');
  assert.equal(resolveNavForRole('WAREHOUSE', 'userAdmin', false, 'ADMIN'), 'userAdmin');
  assert.equal(resolveNavForRole('IQC', 'asnPutaway', true, 'IQC'), 'asnIqc');
  assert.equal(resolveNavForRole('PROCUREMENT', 'asnReceive', false, 'PROCUREMENT'), 'asnPlan');
  assert.equal(resolveNavForRole('PRODUCTION', 'dashboard', false, 'PRODUCTION'), 'replenish');
  assert.equal(resolveNavForRole('PRODUCTION', 'pdaHome', true, 'PRODUCTION'), 'replenish');
  assert.equal(resolveNavForRole('PRODUCTION', 'returnStock', true, 'PRODUCTION'), 'returnStock');
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

test('Master Data tab-level RBAC enforces Procurement partners-only edit, Warehouse non-partners edit, and Production workOrders-only edit', () => {
  const allTabs: MasterTabKey[] = [
    'reels',
    'materials',
    'packaging',
    'barcodeRules',
    'warehouse',
    'partners',
    'workOrders',
  ];

  // PROCUREMENT: ONLY partners is editable; all 6 other tabs are strictly read-only
  assert.equal(canEditMasterTab('PROCUREMENT', 'partners'), true);
  for (const tab of allTabs.filter((t) => t !== 'partners')) {
    assert.equal(canEditMasterTab('PROCUREMENT', tab), false, `PROCUREMENT must be read-only on ${tab}`);
  }
  assert.equal(getDefaultMasterTab('PROCUREMENT'), 'partners');

  // WAREHOUSE: partners is strictly read-only; all other 6 tabs are editable
  assert.equal(canEditMasterTab('WAREHOUSE', 'partners'), false);
  for (const tab of allTabs.filter((t) => t !== 'partners')) {
    assert.equal(canEditMasterTab('WAREHOUSE', tab), true, `WAREHOUSE must be able to edit ${tab}`);
  }
  assert.equal(getDefaultMasterTab('WAREHOUSE'), 'reels');

  // PRODUCTION: ONLY workOrders is editable; all other 6 tabs are strictly read-only
  assert.equal(isNavAllowedForRole('PRODUCTION', 'master', 'PRODUCTION'), true);
  assert.equal(canEditMasterTab('PRODUCTION', 'workOrders'), true);
  for (const tab of allTabs.filter((t) => t !== 'workOrders')) {
    assert.equal(canEditMasterTab('PRODUCTION', tab), false, `PRODUCTION must be read-only on ${tab}`);
  }
  assert.equal(getDefaultMasterTab('PRODUCTION'), 'workOrders');

  // IQC: strictly read-only on all 7 tabs
  for (const tab of allTabs) {
    assert.equal(canEditMasterTab('IQC', tab), false);
  }

  // ADMIN: full edit across all 7 tabs
  for (const tab of allTabs) {
    assert.equal(canEditMasterTab('ADMIN', tab), true);
  }
});
