import { useCallback, useEffect, useState } from 'react';
import { AuthGate } from './components/AuthGate';
import { BarcodeLabelModal } from './components/BarcodeLabelModal';
import { BomMasterView } from './components/BomMasterView';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { DashboardView } from './components/DashboardView';
import { InboundView, type InboundPageMode } from './components/InboundView';
import { InventoryMasterView } from './components/InventoryMasterView';
import { PdaLauncherView } from './components/PdaLauncherView';
import { ReplenishReturnView } from './components/ReplenishReturnView';
import { ScrapCountView } from './components/ScrapCountView';
import { Sidebar, type NavKey } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TraceabilityView } from './components/TraceabilityView';
import { UserAdminView } from './components/UserAdminView';
import { WavePickView } from './components/WavePickView';
import { useAuth } from './context/AuthContext';
import { wmsApi } from './services/wmsApi';
import type { AsnOrder, ReelItem, WmsState } from '../shared/types/wms';
import {
  canManageUsers,
  canSwitchDepartmentView,
  getCrossDepartmentQueueCounts,
  resolveEffectiveDepartmentRole,
  resolveNavForRole,
  type DepartmentRole,
} from '../shared/domain/roleAccess';

const DEPT_STORAGE_KEY = 'smt_wms_department_role';

function loadInitialDepartmentRole(): DepartmentRole {
  if (typeof window === 'undefined') return 'WAREHOUSE';
  const stored = window.localStorage.getItem(DEPT_STORAGE_KEY);
  if (
    stored === 'WAREHOUSE' ||
    stored === 'IQC' ||
    stored === 'PROCUREMENT' ||
    stored === 'PRODUCTION'
  ) {
    return stored;
  }
  return 'WAREHOUSE';
}

const INBOUND_MODES: InboundPageMode[] = [
  'asnArrival',
  'asnReceive',
  'asnIqc',
  'asnPutaway',
  'asnPlan',
  'quickInbound',
];

export default function App() {
  const { user, loading: authLoading, changePassword, signOut } = useAuth();
  const [state, setState] = useState<WmsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adminPreviewDept, setAdminPreviewDept] = useState<DepartmentRole>(
    loadInitialDepartmentRole
  );
  const [activeNav, setActiveNav] = useState<NavKey>(() => {
    const initialRole = loadInitialDepartmentRole();
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    return resolveNavForRole(initialRole, isMobile ? 'pdaHome' : 'dashboard', isMobile);
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [traceQuery, setTraceQuery] = useState('');
  const [inboundPrefillSku, setInboundPrefillSku] = useState<string | undefined>(undefined);
  const [selectedAsnNo, setSelectedAsnNo] = useState('');
  const [stageTransitionNotice, setStageTransitionNotice] = useState<string | null>(null);
  const [labelReel, setLabelReel] = useState<ReelItem | null>(null);
  const [changePwdOpen, setChangePwdOpen] = useState(false);

  const userRole = user?.role ?? 'WAREHOUSE';
  const effectiveDeptRole = resolveEffectiveDepartmentRole(userRole, adminPreviewDept);

  const fetchState = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setLoadError(null);
      const res = await wmsApi.getState();
      setState(res.state);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '无法加载仓储数据');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setState(null);
      setLoadError(null);
      setLoading(false);
      setChangePwdOpen(false);
      return;
    }
    fetchState();
  }, [user, fetchState]);

  // Whenever signed-in account changes, land directly on that account's authorized default page
  useEffect(() => {
    if (!user) return;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    const targetDept = resolveEffectiveDepartmentRole(user.role, adminPreviewDept);
    const defaultCandidate: NavKey = isMobile ? 'pdaHome' : 'dashboard';
    setSelectedAsnNo('');
    setStageTransitionNotice(null);
    setActiveNav(resolveNavForRole(targetDept, defaultCandidate, isMobile, user.role));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, user?.role]);

  // Keep activeNav clamped whenever admin preview department changes
  useEffect(() => {
    if (!user) return;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    setActiveNav((prev) => resolveNavForRole(effectiveDeptRole, prev, isMobile, userRole));
  }, [user, effectiveDeptRole, userRole]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeNav]);

  const handleChangeDepartmentRole = (nextRole: DepartmentRole) => {
    if (!canSwitchDepartmentView(userRole)) return;
    setAdminPreviewDept(nextRole);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DEPT_STORAGE_KEY, nextRole);
    }
    setStageTransitionNotice(null);
    setSelectedAsnNo('');
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    setActiveNav((prev) => resolveNavForRole(nextRole, prev, isMobile, userRole));
  };

  const handleSelectNav = (nav: NavKey) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    setStageTransitionNotice(null);
    setActiveNav(resolveNavForRole(effectiveDeptRole, nav, isMobile, userRole));
  };

  const handleAdvanceStagePage = (nextNav: NavKey, asnNo: string, notice: string) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    const safeNav = resolveNavForRole(effectiveDeptRole, nextNav, isMobile, userRole);
    setSelectedAsnNo(asnNo);
    setStageTransitionNotice(notice || null);
    setActiveNav(safeNav);
  };

  const handleInspectTrace = (query: string) => {
    setTraceQuery(query);
    setStageTransitionNotice(null);
    setActiveNav('trace');
  };

  const handleGoInboundWithSku = (skuCode: string) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    setInboundPrefillSku(skuCode);
    setStageTransitionNotice(null);
    setActiveNav(resolveNavForRole(effectiveDeptRole, 'quickInbound', isMobile, userRole));
  };

  const handleBakeMsd = async (reelId: string) => {
    const res = await wmsApi.bakeMsdReel({
      reelId,
      operator: user?.displayName || 'IQC烘烤专员',
    });
    setState(res.state);
  };

  const handleResetDemo = async () => {
    const res = await wmsApi.resetDemo();
    setState(res.state);
    setSelectedAsnNo('');
    setStageTransitionNotice(null);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f5f7]">
        <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-xs">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />
          正在初始化 MES 仓储工作台...
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  if (loading && !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f5f7]">
        <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-xs">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />
          正在加载 SMT-WMS 仓储数据...
        </div>
      </div>
    );
  }

  if (loadError || !state) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f3f5f7] p-4">
        <div className="rounded-lg border border-red-200 bg-white px-6 py-5 text-center shadow-xs">
          <div className="text-sm font-semibold text-red-700">{loadError || '数据加载异常'}</div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={fetchState}
              className="rounded-md bg-teal-700 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-teal-800"
            >
              重试连接
            </button>
            <button
              type="button"
              onClick={signOut}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              切换账号
            </button>
          </div>
        </div>
      </div>
    );
  }

  const msdAlertCount = state.reels.filter(
    (r) => r.msdState === 'BAKING_REQUIRED' && r.status !== 'SCRAPPED' && r.status !== 'DEPLETED'
  ).length;
  const queueCounts = getCrossDepartmentQueueCounts(state.asns);

  const isInboundMode = INBOUND_MODES.includes(activeNav as InboundPageMode);

  return (
    <div className="flex min-h-screen bg-[#f3f5f7] text-slate-900">
      <Sidebar
        active={activeNav}
        userRole={userRole}
        departmentRole={effectiveDeptRole}
        onChangeDepartmentRole={handleChangeDepartmentRole}
        queueCounts={queueCounts}
        onSelect={handleSelectNav}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        msdAlertCount={msdAlertCount}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          activeNav={activeNav}
          userRole={userRole}
          departmentRole={effectiveDeptRole}
          onChangeDepartmentRole={handleChangeDepartmentRole}
          notifiedIqcCount={queueCounts.notifiedIqcCount}
          iqcReleasedPutawayCount={queueCounts.iqcReleasedPutawayCount}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onSelectNav={handleSelectNav}
          onQuickScan={handleInspectTrace}
          userName={user.displayName || user.username}
          userEmail={user.username ? `@${user.username}` : user.email}
          onOpenChangePassword={
            user.authProvider === 'password' ? () => setChangePwdOpen(true) : undefined
          }
          onSignOut={signOut}
        />

        <main className="flex-1 p-3 sm:p-4 lg:p-6">
          <div className="mx-auto max-w-[1400px]">
            {activeNav === 'pdaHome' && (
              <PdaLauncherView state={state} onSelectNav={handleSelectNav} />
            )}

            {activeNav === 'dashboard' && (
              <DashboardView
                state={state}
                onNavigate={handleSelectNav}
                onGoInboundWithSku={handleGoInboundWithSku}
                onQuickInbound={async (payload) => {
                  const res = await wmsApi.inbound(payload);
                  setState(res.state);
                  return res.payload.reel as ReelItem;
                }}
                onQuickCreateAsn={async (payload) => {
                  const res = await wmsApi.createAsn(payload);
                  setState(res.state);
                  return res.payload.asn as AsnOrder;
                }}
                onOpenLabel={setLabelReel}
                onInspectTrace={handleInspectTrace}
                onBakeMsd={handleBakeMsd}
                onResetDemo={handleResetDemo}
              />
            )}

            {isInboundMode && (
              <InboundView
                pageMode={activeNav as InboundPageMode}
                state={state}
                selectedAsnNo={selectedAsnNo}
                onSelectAsnNo={setSelectedAsnNo}
                transitionNotice={stageTransitionNotice}
                onClearTransitionNotice={() => setStageTransitionNotice(null)}
                onAdvanceStagePage={handleAdvanceStagePage}
                onNavigate={handleSelectNav}
                initialSkuCode={inboundPrefillSku}
                onInbound={async (payload) => {
                  const res = await wmsApi.inbound(payload);
                  setState(res.state);
                  return res.payload.reel as ReelItem;
                }}
                onCreateAsn={async (payload) => {
                  const res = await wmsApi.createAsn(payload);
                  setState(res.state);
                  return res.payload.asn as AsnOrder;
                }}
                onImportAsnCsv={async (payload) => {
                  const res = await wmsApi.importAsnCsv(payload);
                  setState(res.state);
                  return res.payload.asn as AsnOrder;
                }}
                onCancelAsn={async (asnNo) => {
                  const res = await wmsApi.cancelAsn(asnNo);
                  setState(res.state);
                }}
                onArriveAsn={async (asnNo, payload) => {
                  const res = await wmsApi.arriveAsn(asnNo, payload);
                  setState(res.state);
                  return res.payload;
                }}
                onScanAsnReceive={async (asnNo, payload) => {
                  const res = await wmsApi.scanAsnReceive(asnNo, payload);
                  setState(res.state);
                  return res.payload;
                }}
                onInspectAsnIqc={async (asnNo, payload) => {
                  const res = await wmsApi.inspectAsnIqc(asnNo, payload);
                  setState(res.state);
                  return res.payload;
                }}
                onPutawayAsnLine={async (asnNo, payload) => {
                  const res = await wmsApi.putawayAsnLine(asnNo, payload);
                  setState(res.state);
                  return res.payload;
                }}
                onSyncAsnInfo={async (asnNo, payload) => {
                  const res = await wmsApi.syncAsnInfo(asnNo, payload);
                  setState(res.state);
                  return res.payload.asn;
                }}
                onOpenLabel={setLabelReel}
                onInspectTrace={handleInspectTrace}
              />
            )}

            {(activeNav === 'wavePlan' ||
              activeNav === 'wavePick' ||
              activeNav === 'generalOutbound') && (
              <WavePickView
                pageMode={activeNav}
                state={state}
                onNavigate={handleSelectNav}
                onCreateWave={async (payload) => {
                  const res = await wmsApi.createWave(payload);
                  setState(res.state);
                  return { shortages: res.payload.shortages };
                }}
                onIssueWaveReel={async (waveId, reelId, operator) => {
                  const res = await wmsApi.issueWaveReel(waveId, { reelId, operator });
                  setState(res.state);
                }}
                onGeneralOutbound={async (payload) => {
                  const res = await wmsApi.generalOutbound(payload);
                  setState(res.state);
                }}
              />
            )}

            {(activeNav === 'replenish' || activeNav === 'returnStock') && (
              <ReplenishReturnView
                pageMode={activeNav}
                state={state}
                onReplenish={async (payload) => {
                  const res = await wmsApi.replenish(payload);
                  setState(res.state);
                }}
                onReturn={async (payload) => {
                  const res = await wmsApi.productionReturn(payload);
                  setState(res.state);
                  return res.payload.reel as ReelItem;
                }}
                onOpenLabel={setLabelReel}
              />
            )}

            {(activeNav === 'scrap' ||
              activeNav === 'countPlan' ||
              activeNav === 'cycleCount') && (
              <ScrapCountView
                pageMode={activeNav}
                state={state}
                onNavigate={handleSelectNav}
                onScrap={async (payload) => {
                  const res = await wmsApi.scrap(payload);
                  setState(res.state);
                }}
                onCreateCycleCount={async (payload) => {
                  const res = await wmsApi.createCycleCount(payload);
                  setState(res.state);
                }}
                onReconcileCycleCount={async (countId, payload) => {
                  const res = await wmsApi.reconcileCycleCount(countId, payload);
                  setState(res.state);
                }}
              />
            )}

            {activeNav === 'trace' && (
              <TraceabilityView
                state={state}
                initialQuery={traceQuery}
                onOpenLabel={setLabelReel}
              />
            )}

            {activeNav === 'bom' && (
              <BomMasterView
                state={state}
                onSaveBom={async (bom) => {
                  const res = await wmsApi.saveBom(bom);
                  setState(res.state);
                }}
                onDeleteBom={async (bomId) => {
                  const res = await wmsApi.deleteBom(bomId);
                  setState(res.state);
                }}
              />
            )}

            {activeNav === 'master' && (
              <InventoryMasterView
                state={state}
                userRole={userRole}
                departmentRole={effectiveDeptRole}
                onOpenLabel={setLabelReel}
                onInspectTrace={handleInspectTrace}
                onBakeMsd={handleBakeMsd}
                onAddMaterial={async (mat) => {
                  const res = await wmsApi.addMaterial(mat);
                  setState(res.state);
                }}
                onUpdateMaterial={async (originalKey, mat) => {
                  const res = await wmsApi.updateMaterial(originalKey, mat);
                  setState(res.state);
                }}
                onDeleteMaterial={async (materialKey) => {
                  const res = await wmsApi.deleteMaterial(materialKey);
                  setState(res.state);
                }}
                onAddPackagingSpec={async (spec) => {
                  const res = await wmsApi.addPackagingSpec(spec);
                  setState(res.state);
                }}
                onUpdatePackagingSpec={async (code, spec) => {
                  const res = await wmsApi.updatePackagingSpec(code, spec);
                  setState(res.state);
                }}
                onDeletePackagingSpec={async (code) => {
                  const res = await wmsApi.deletePackagingSpec(code);
                  setState(res.state);
                }}
                onSaveBarcodeRule={async (rule) => {
                  const res = await wmsApi.saveBarcodeRule(rule);
                  setState(res.state);
                }}
                onDeleteBarcodeRule={async (ruleId) => {
                  const res = await wmsApi.deleteBarcodeRule(ruleId);
                  setState(res.state);
                }}
                onSaveLabelTemplate={async (tpl) => {
                  const res = await wmsApi.saveLabelTemplate(tpl);
                  setState(res.state);
                }}
                onDeleteLabelTemplate={async (templateId) => {
                  const res = await wmsApi.deleteLabelTemplate(templateId);
                  setState(res.state);
                }}
                onAddWarehouse={async (wh) => {
                  const res = await wmsApi.addWarehouse(wh);
                  setState(res.state);
                }}
                onUpdateWarehouse={async (code, wh) => {
                  const res = await wmsApi.updateWarehouse(code, wh);
                  setState(res.state);
                }}
                onDeleteWarehouse={async (code) => {
                  const res = await wmsApi.deleteWarehouse(code);
                  setState(res.state);
                }}
                onAddBin={async (bin) => {
                  const res = await wmsApi.addBin(bin);
                  setState(res.state);
                }}
                onUpdateBin={async (binCode, bin) => {
                  const res = await wmsApi.updateBin(binCode, bin);
                  setState(res.state);
                }}
                onDeleteBin={async (binCode) => {
                  const res = await wmsApi.deleteBin(binCode);
                  setState(res.state);
                }}
                onAddKeeper={async (keeper) => {
                  const res = await wmsApi.addKeeper(keeper);
                  setState(res.state);
                }}
                onUpdateKeeper={async (keeperId, keeper) => {
                  const res = await wmsApi.updateKeeper(keeperId, keeper);
                  setState(res.state);
                }}
                onDeleteKeeper={async (keeperId) => {
                  const res = await wmsApi.deleteKeeper(keeperId);
                  setState(res.state);
                }}
                onAddSupplier={async (sup) => {
                  const res = await wmsApi.addSupplier(sup);
                  setState(res.state);
                }}
                onUpdateSupplier={async (code, sup) => {
                  const res = await wmsApi.updateSupplier(code, sup);
                  setState(res.state);
                }}
                onDeleteSupplier={async (code) => {
                  const res = await wmsApi.deleteSupplier(code);
                  setState(res.state);
                }}
                onAddCustomer={async (cus) => {
                  const res = await wmsApi.addCustomer(cus);
                  setState(res.state);
                }}
                onUpdateCustomer={async (code, cus) => {
                  const res = await wmsApi.updateCustomer(code, cus);
                  setState(res.state);
                }}
                onDeleteCustomer={async (code) => {
                  const res = await wmsApi.deleteCustomer(code);
                  setState(res.state);
                }}
                onAddWorkOrder={async (wo) => {
                  const res = await wmsApi.addWorkOrder(wo);
                  setState(res.state);
                }}
              />
            )}

            {activeNav === 'userAdmin' && canManageUsers(userRole) && (
              <UserAdminView currentUserUid={user.uid} />
            )}
          </div>
        </main>
      </div>

      <BarcodeLabelModal
        reel={labelReel}
        templates={state.labelTemplates}
        materials={state.materials}
        printerConfig={state.printerConfig}
        onSavePrinterConfig={async (cfg) => {
          const res = await wmsApi.savePrinterConfig(cfg);
          setState(res.state);
        }}
        onClose={() => setLabelReel(null)}
      />

      {user.authProvider === 'password' && (
        <ChangePasswordModal
          open={changePwdOpen}
          username={user.username || user.displayName || ''}
          onSubmit={changePassword}
          onClose={() => setChangePwdOpen(false)}
        />
      )}
    </div>
  );
}
