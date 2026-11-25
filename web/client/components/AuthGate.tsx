import {
  Cpu,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  Lock,
  ScanBarcode,
  ShieldCheck,
  User,
  UserPlus,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function AuthGate() {
  const {
    loginWithPassword,
    bootstrapInitialAdmin,
    needsInitialAdmin,
    signingIn,
    authError,
    clearAuthError,
  } = useAuth();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    const trimmedUser = username.trim();
    if (!trimmedUser) {
      setLocalError('请输入账号名称');
      return;
    }
    if (trimmedUser.length < 3 || trimmedUser.length > 32) {
      setLocalError('账号长度需在 3 - 32 个字符之间');
      return;
    }
    if (!/^[a-zA-Z0-9._@-]+$/.test(trimmedUser)) {
      setLocalError('账号仅支持字母、数字及 . _ - @ 符号');
      return;
    }
    if (!password || password.length < 6) {
      setLocalError('密码长度不能少于 6 位');
      return;
    }

    if (needsInitialAdmin) {
      if (password !== confirmPassword) {
        setLocalError('两次输入的密码不一致，请核对');
        return;
      }
      try {
        await bootstrapInitialAdmin({
          username: trimmedUser,
          password,
          displayName: displayName.trim() || undefined,
        });
      } catch {
        // Error surfaced via authError
      }
      return;
    }

    try {
      await loginWithPassword(trimmedUser, password);
    } catch {
      // Error surfaced via authError
    }
  };

  const displayedError = localError || authError;

  return (
    <div className="flex min-h-screen flex-col-reverse bg-[#f3f5f7] text-slate-900 lg:flex-row">
      {/* Left Deep Carbon Industrial Brand Rail */}
      <section className="mes-carbon-grid relative flex flex-col justify-between border-t border-white/[0.08] px-6 py-9 text-slate-100 lg:w-[46%] lg:border-r lg:border-t-0 lg:px-14 lg:py-14">
        <div className="hidden items-center gap-3.5 lg:flex">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-white shadow-xs">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-base font-semibold tracking-tight text-white">
              SMT-WMS 智能电子仓
            </div>
            <div className="text-xs text-slate-400">
              电子制造料盘全生命周期仓储执行系统
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:my-0">
          <div className="text-xs font-medium tracking-wide text-teal-400">
            精益电子制造 · MES / WMS 车间仓储中台
          </div>
          <h1
            className="font-display max-w-lg text-2xl font-bold leading-tight tracking-tight text-white lg:text-[38px] lg:leading-[1.18]"
            style={{ textWrap: 'balance' }}
          >
            精准管控每一盘电子物料与 MSD 车间寿命
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-slate-300/90">
            覆盖采购 ASN 预约与仓库初收、IQC 独立质检防呆、UID 唯一码与 Zebra ZPL
            可视化打印、FIFO 波次配料发料及全链路批次正反向追溯。
          </p>

          <dl className="grid grid-cols-1 divide-y divide-white/[0.08] border-y border-white/[0.08] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="py-4 sm:pr-4">
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-teal-300">
                <ScanBarcode className="h-3.5 w-3.5 shrink-0" />
                UID 与 ZPL 直打
              </dt>
              <dd className="mt-1.5 text-xs leading-relaxed text-slate-400">
                可视化热敏标签设计与斑马打印机指令直出
              </dd>
            </div>
            <div className="py-4 sm:px-4">
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-teal-300">
                <Layers className="h-3.5 w-3.5 shrink-0" />
                岗位职权隔离
              </dt>
              <dd className="mt-1.5 text-xs leading-relaxed text-slate-400">
                采购 / 仓库 / IQC / 生产按岗位角色严格隔离作业
              </dd>
            </div>
            <div className="py-4 sm:pl-4">
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-teal-300">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                MSD 防潮闭环
              </dt>
              <dd className="mt-1.5 text-xs leading-relaxed text-slate-400">
                J-STD-033 暴露计时预警与烘烤复位留痕
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-8 flex items-center justify-between gap-4 border-t border-white/[0.08] pt-5 text-xs text-slate-500 lg:mt-0">
          <span>SMT 电子制造仓储作业平台</span>
          <span className="font-mono text-[11px] text-slate-400">PC 管理端 · PDA 手持终端</span>
        </div>
      </section>

      {/* Right Sign-In Panel (Strictly Login Only — Admin Creates Staff Accounts) */}
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-8 lg:px-16 lg:py-12">
        <div className="mb-5 flex w-full max-w-md items-center gap-3 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#11161e] text-teal-400">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-base font-semibold tracking-tight text-slate-900">
              SMT-WMS 智能电子仓
            </div>
            <div className="text-xs text-slate-500">
              电子制造料盘全生命周期仓储执行系统
            </div>
          </div>
        </div>

        <div className="mes-panel w-full max-w-md rounded-xl p-7 lg:p-8">
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              {needsInitialAdmin ? '初始化系统管理员' : '登录仓储工作台'}
            </h2>
            <p className="text-xs leading-relaxed text-slate-500">
              {needsInitialAdmin
                ? '首次部署检测到系统尚无管理员，请创建首位管理员账号（完成后将永久关闭初始化入口）。'
                : '请使用管理员分配的岗位工号与密码登录，系统将自动进入对应部门工作台。'}
            </p>
          </div>

          {displayedError && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
            >
              {displayedError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-3.5" noValidate>
            <div>
              <label
                htmlFor="auth-username"
                className="mb-1 block text-xs font-medium text-slate-700"
              >
                账号 / 工号
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="例如：admin、wh_01、iqc_01、po_01、prod_01"
                  className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                />
              </div>
            </div>

            {needsInitialAdmin && (
              <div>
                <label
                  htmlFor="auth-display-name"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  管理员姓名（选填）
                </label>
                <div className="relative">
                  <UserPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="auth-display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="例如：系统管理员 / 厂务主管"
                    className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                  />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-password"
                className="mb-1 block text-xs font-medium text-slate-700"
              >
                登录密码
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={needsInitialAdmin ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码（至少 6 位）"
                  className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {needsInitialAdmin && (
              <div>
                <label
                  htmlFor="auth-confirm-password"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  确认密码
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="请再次输入密码"
                    className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={signingIn}
              className="mt-1 flex w-full items-center justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingIn
                ? '正在处理...'
                : needsInitialAdmin
                  ? '创建管理员并进入工作台'
                  : '登录工作台'}
            </button>
          </form>

          <div className="mt-5 flex items-start gap-2 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>
              本系统仅支持内部工号密码登录，不开放自助注册及第三方登录。如需开设员工账号、重置密码或调整岗位权限，请联系系统管理员统一分配。
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
