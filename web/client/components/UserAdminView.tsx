import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Search,
  Shield,
  UserCheck,
  UserPlus,
  UserX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { wmsApi, type AdminUserRecord } from '../services/wmsApi';
import {
  USER_ROLE_LIST,
  USER_ROLE_META,
  type UserRole,
  type UserStatus,
} from '../../shared/domain/roleAccess';

interface UserAdminViewProps {
  currentUserUid: string;
}

export function UserAdminView({ currentUserUid }: UserAdminViewProps) {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Create account form state
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>('WAREHOUSE');
  const [creating, setCreating] = useState(false);
  const [createFeedback, setCreateFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Table filter & row actions
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [tableFeedback, setTableFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Inline password reset state
  const [resetTarget, setResetTarget] = useState<AdminUserRecord | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [resetting, setResetting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await wmsApi.adminListUsers();
      setUsers(res.users);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '加载账号列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const roleCounts = useMemo(() => {
    const counts: Record<UserRole, number> = {
      ADMIN: 0,
      WAREHOUSE: 0,
      IQC: 0,
      PROCUREMENT: 0,
      PRODUCTION: 0,
    };
    let activeCount = 0;
    for (const u of users) {
      counts[u.role] = (counts[u.role] ?? 0) + 1;
      if (u.status === 'ACTIVE') activeCount += 1;
    }
    return { ...counts, total: users.length, activeCount };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        (u.username ?? '').toLowerCase().includes(q) ||
        (u.displayName ?? '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery, roleFilter]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateFeedback(null);
    const trimmedUser = newUsername.trim();
    if (!trimmedUser) {
      setCreateFeedback({ type: 'error', message: '请输入新员工工号或账号名' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setCreateFeedback({ type: 'error', message: '初始密码长度不能少于 6 位' });
      return;
    }

    setCreating(true);
    try {
      const res = await wmsApi.adminCreateUser({
        username: trimmedUser,
        password: newPassword,
        displayName: newDisplayName.trim() || undefined,
        role: newRole,
      });
      setUsers((prev) => [res.user, ...prev]);
      setCreateFeedback({
        type: 'success',
        message: `已创建账号 ${res.user.username}（岗位：${USER_ROLE_META[res.user.role].label}），员工可立即登录使用。`,
      });
      setNewUsername('');
      setNewDisplayName('');
      setNewPassword('');
    } catch (err) {
      setCreateFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : '创建账号失败',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateUser = async (
    target: AdminUserRecord,
    patch: { role?: UserRole; status?: UserStatus }
  ) => {
    setTableFeedback(null);
    setBusyUid(target.uid);
    try {
      const res = await wmsApi.adminUpdateUser(target.uid, patch);
      setUsers((prev) => prev.map((u) => (u.uid === target.uid ? res.user : u)));
      const label = target.username || target.displayName || target.email;
      if (patch.role) {
        setTableFeedback({
          type: 'success',
          message: `已将 ${label} 的岗位调整为「${USER_ROLE_META[res.user.role].label}」，下次请求即时生效。`,
        });
      } else if (patch.status) {
        setTableFeedback({
          type: 'success',
          message:
            res.user.status === 'DISABLED'
              ? `已停用账号 ${label} 并立即吊销其在线会话。`
              : `已重新启用账号 ${label}。`,
        });
      }
    } catch (err) {
      setTableFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : '更新账号权限失败',
      });
    } finally {
      setBusyUid(null);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    if (!resetPasswordInput || resetPasswordInput.length < 6) {
      setTableFeedback({ type: 'error', message: '新密码长度不能少于 6 位' });
      return;
    }
    setResetting(true);
    setTableFeedback(null);
    try {
      await wmsApi.adminResetUserPassword(resetTarget.uid, {
        newPassword: resetPasswordInput,
      });
      setTableFeedback({
        type: 'success',
        message: `已重置账号 ${resetTarget.username || resetTarget.email} 的登录密码，原在线会话已失效。`,
      });
      setResetTarget(null);
      setResetPasswordInput('');
    } catch (err) {
      setTableFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : '重置密码失败',
      });
    } finally {
      setResetting(false);
    }
  };

  const selectedRoleMeta = USER_ROLE_META[newRole];

  return (
    <div className="space-y-4">
      {/* Header & Role KPI Strip */}
      <section className="mes-panel rounded-lg p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-teal-700" />
              <h2 className="text-base font-semibold text-slate-900">
                账号与岗位权限管理（固定角色 RBAC）
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              系统仅保留内部工号密码登录（已关闭公开注册与第三方登录）。仅管理员可开设岗位账号，员工登录后将严格锁定本部门菜单与接口权限。
            </p>
          </div>
          <button
            type="button"
            onClick={fetchUsers}
            disabled={loading}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-teal-300 hover:text-teal-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新台账
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200/80 pt-4 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <dt className="text-[11px] text-slate-500">总账号 / 启用中</dt>
            <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900">
              {roleCounts.total}
              <span className="ml-1 text-xs font-medium text-emerald-700">
                ({roleCounts.activeCount} 启用)
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-500">系统管理员</dt>
            <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-800">
              {roleCounts.ADMIN}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-500">仓库员</dt>
            <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-teal-700">
              {roleCounts.WAREHOUSE}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-500">IQC 质检员</dt>
            <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-amber-700">
              {roleCounts.IQC}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-500">采购员</dt>
            <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-indigo-700">
              {roleCounts.PROCUREMENT}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-500">生产员</dt>
            <dd className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-700">
              {roleCounts.PRODUCTION}
            </dd>
          </div>
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-start">
        {/* Left: Admin Create Employee Account Form */}
        <section className="mes-panel rounded-lg p-4 sm:p-5 xl:col-span-4">
          <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
            <UserPlus className="h-4 w-4 text-teal-700" />
            <h3 className="text-sm font-semibold text-slate-900">新增员工账号</h3>
          </div>

          <form onSubmit={handleCreateUser} className="mt-4 space-y-3.5" noValidate>
            <div>
              <label
                htmlFor="admin-new-username"
                className="mb-1 block text-xs font-medium text-slate-700"
              >
                登录账号 / 工号 <span className="text-red-600">*</span>
              </label>
              <input
                id="admin-new-username"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="例如：wh_01、iqc_01、po_01、prod_01"
                className="min-h-[40px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
              />
            </div>

            <div>
              <label
                htmlFor="admin-new-display-name"
                className="mb-1 block text-xs font-medium text-slate-700"
              >
                员工姓名（选填）
              </label>
              <input
                id="admin-new-display-name"
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="例如：张仓管 / 陈质检 / 林采购 / 王产线"
                className="min-h-[40px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
              />
            </div>

            <div>
              <label
                htmlFor="admin-new-password"
                className="mb-1 block text-xs font-medium text-slate-700"
              >
                初始登录密码 <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <input
                  id="admin-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少 6 位字符"
                  className="min-h-[40px] w-full rounded-md border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  aria-label={showNewPassword ? '隐藏初始密码' : '显示初始密码'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-new-role"
                className="mb-1 block text-xs font-medium text-slate-700"
              >
                分配岗位角色 <span className="text-red-600">*</span>
              </label>
              <select
                id="admin-new-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="min-h-[40px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/15"
              >
                {USER_ROLE_LIST.map((r) => (
                  <option key={r} value={r}>
                    {USER_ROLE_META[r].label}（{USER_ROLE_META[r].badge}）
                  </option>
                ))}
              </select>
              <p className="mt-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] leading-relaxed text-slate-600">
                {selectedRoleMeta.description}
              </p>
            </div>

            {createFeedback && (
              <div
                role={createFeedback.type === 'error' ? 'alert' : 'status'}
                className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs font-medium ${
                  createFeedback.type === 'error'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                }`}
              >
                {createFeedback.type === 'success' && (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                )}
                <span>{createFeedback.message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={creating}
              className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" />
              {creating ? '正在创建...' : '创建岗位账号'}
            </button>
          </form>
        </section>

        {/* Right: Account Ledger & Inline Role Assignment */}
        <section className="mes-panel overflow-hidden rounded-lg xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3.5 sm:px-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                全员账号与岗位台账 ({filteredUsers.length})
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                可直接修改岗位角色或停用账号；停用后将即时强制下线。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="搜索员工账号或姓名"
                  placeholder="搜工号 / 姓名 / 邮箱"
                  className="min-h-[34px] w-44 rounded-md border border-slate-200 bg-slate-50 py-1 pl-8 pr-2.5 text-xs text-slate-900 focus:border-teal-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div
                role="group"
                aria-label="按岗位筛选账号"
                className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5 text-[11px]"
              >
                {(['ALL', ...USER_ROLE_LIST] as const).map((r) => {
                  const active = roleFilter === r;
                  const label = r === 'ALL' ? '全部' : USER_ROLE_META[r].shortLabel;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoleFilter(r)}
                      className={`rounded px-2 py-1 font-semibold transition-colors ${
                        active
                          ? 'bg-white text-teal-800 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {tableFeedback && (
            <div
              role={tableFeedback.type === 'error' ? 'alert' : 'status'}
              className={`mx-4 mt-3 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs font-medium sm:mx-5 ${
                tableFeedback.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              <span>{tableFeedback.message}</span>
              <button
                type="button"
                onClick={() => setTableFeedback(null)}
                aria-label="关闭提示"
                className="rounded p-0.5 opacity-70 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {resetTarget && (
            <form
              onSubmit={handleResetPasswordSubmit}
              className="mx-4 mt-3 flex flex-wrap items-end gap-2 rounded-md border border-teal-200 bg-teal-50/50 p-3 sm:mx-5"
            >
              <div className="min-w-[180px] flex-1">
                <label
                  htmlFor="admin-reset-pwd-input"
                  className="block text-xs font-semibold text-teal-900"
                >
                  为 {resetTarget.username || resetTarget.email} 重置新密码
                </label>
                <input
                  id="admin-reset-pwd-input"
                  type="password"
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  placeholder="输入新密码（至少 6 位）"
                  className="mt-1 min-h-[36px] w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={resetting}
                className="min-h-[36px] rounded-md bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {resetting ? '提交中...' : '确认重置'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResetTarget(null);
                  setResetPasswordInput('');
                }}
                className="min-h-[36px] rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
            </form>
          )}

          {loadError ? (
            <div className="p-6 text-center text-xs text-red-700">{loadError}</div>
          ) : loading && users.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">正在加载账号台账...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              当前筛选条件下没有匹配的账号记录
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredUsers.map((u) => {
                const isSelf = u.uid === currentUserUid;
                const isBusy = busyUid === u.uid;
                const meta = USER_ROLE_META[u.role];
                return (
                  <div
                    key={u.uid}
                    className={`flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${
                      u.status === 'DISABLED' ? 'bg-slate-50/60 opacity-75' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-slate-900">
                          {u.username || u.email}
                        </span>
                        {u.displayName && u.displayName !== u.username && (
                          <span className="text-xs text-slate-600">({u.displayName})</span>
                        )}
                        {isSelf && (
                          <span className="rounded border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800">
                            当前登录
                          </span>
                        )}
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                            u.status === 'ACTIVE'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-red-200 bg-red-50 text-red-700'
                          }`}
                        >
                          {u.status === 'ACTIVE' ? '启用中' : '已停用'}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                        <span>工号密码账号</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono">{u.email}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <label className="sr-only" htmlFor={`role-select-${u.uid}`}>
                        调整 {u.username || u.email} 的岗位角色
                      </label>
                      <select
                        id={`role-select-${u.uid}`}
                        aria-label={`调整 ${u.username || u.email} 的岗位角色`}
                        disabled={isBusy}
                        value={u.role}
                        onChange={(e) =>
                          handleUpdateUser(u, { role: e.target.value as UserRole })
                        }
                        className={`min-h-[34px] rounded-md border px-2.5 py-1 text-xs font-semibold focus:border-teal-600 focus:outline-none disabled:opacity-50 ${meta.toneClass}`}
                      >
                        {USER_ROLE_LIST.map((r) => (
                          <option key={r} value={r} className="bg-white text-slate-900">
                            {USER_ROLE_META[r].label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setResetTarget(u);
                          setResetPasswordInput('');
                        }}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-teal-300 hover:text-teal-800 disabled:opacity-50"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        重设密码
                      </button>

                      <button
                        type="button"
                        disabled={isBusy || isSelf}
                        title={isSelf ? '不可停用当前登录的管理员账号' : undefined}
                        onClick={() =>
                          handleUpdateUser(u, {
                            status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                          })
                        }
                        className={`inline-flex min-h-[34px] items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                          u.status === 'ACTIVE'
                            ? 'border-red-200 bg-white text-red-700 hover:bg-red-50'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        }`}
                      >
                        {u.status === 'ACTIVE' ? (
                          <>
                            <UserX className="h-3.5 w-3.5" />
                            停用
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3.5 w-3.5" />
                            启用
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
