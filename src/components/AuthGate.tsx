import {
  Cpu,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  ScanBarcode,
  ShieldCheck,
  User,
  UserPlus,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

type AuthMode = 'login' | 'register';

export function AuthGate() {
  const {
    loginWithPassword,
    registerWithPassword,
    signInWithGoogle,
    signingIn,
    authError,
    clearAuthError,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setLocalError(null);
    clearAuthError();
    setConfirmPassword('');
  };

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

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setLocalError('两次输入的密码不一致，请核对');
        return;
      }
      try {
        await registerWithPassword({
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
    <div className="flex min-h-screen flex-col-reverse bg-slate-50 text-slate-900 lg:flex-row">
      {/* Left Industrial Brand Rail */}
      <section className="relative flex flex-col justify-between bg-slate-900 px-6 py-8 text-white lg:w-[46%] lg:px-14 lg:py-14">
        <div className="hidden items-center gap-3 lg:flex">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-600 text-white">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-base font-semibold tracking-tight text-white">
              SMT-WMS 智能电子仓
            </div>
            <div className="text-xs text-slate-400">
              电子制造料盘全生命周期仓储管理系统
            </div>
          </div>
        </div>

        <div className="space-y-5 lg:my-0">
          <div className="text-xs font-semibold uppercase tracking-widest text-sky-400">
            ENTERPRISE SMT MANUFACTURING
          </div>
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-white lg:text-4xl">
            精准管控每一盘电子物料与 MSD 车间寿命
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-slate-300">
            覆盖 ASN 采购收料、UID 唯一码与 ZPL 可视化条码打印、FIFO 波次配料发料、
            产线补退料、湿敏烘烤预警及全链路批次正反向追溯。
          </p>

          <dl className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3 lg:gap-4 lg:pt-4">
            <div className="rounded-lg border border-slate-800 bg-slate-800/50 p-3.5">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-sky-400">
                <ScanBarcode className="h-3.5 w-3.5" />
                UID &amp; ZPL
              </dt>
              <dd className="mt-1.5 text-xs text-slate-300">
                可视化热敏标签设计与 Zebra 指令直打
              </dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-800/50 p-3.5">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-sky-400">
                <Layers className="h-3.5 w-3.5" />
                FIFO &amp; BOM
              </dt>
              <dd className="mt-1.5 text-xs text-slate-300">
                按客户产权与替代料规则自动锁定波次
              </dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-800/50 p-3.5">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-sky-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                MSD 防潮闭环
              </dt>
              <dd className="mt-1.5 text-xs text-slate-300">
                拆封暴露计时预警与烘烤复位全记录
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 text-xs text-slate-500 lg:mt-0">
          SMT 电子制造仓储作业平台 · 身份认证访问控制
        </div>
      </section>

      {/* Right Sign-In / Register Panel */}
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-8 lg:px-16 lg:py-12">
        <div className="mb-5 flex w-full max-w-md items-center gap-3 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-700 text-white">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-base font-semibold tracking-tight text-slate-900">
              SMT-WMS 智能电子仓
            </div>
            <div className="text-xs text-slate-500">
              电子制造料盘全生命周期仓储管理系统
            </div>
          </div>
        </div>

        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-7 shadow-sm lg:p-8">
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              {mode === 'login' ? '登录仓储工作台' : '注册自定义账号'}
            </h2>
            <p className="text-xs leading-relaxed text-slate-500">
              {mode === 'login'
                ? '支持自定义工号/账号密码登录，或直接使用 Google 账号进入专属 SMT 仓储工作空间。'
                : '创建您的专属工号或自定义账号，注册后将自动为您初始化标准 SMT 仓储数据。'}
            </p>
          </div>

          {/* Mode Tabs */}
          <div
            role="tablist"
            aria-label="登录方式切换"
            className="mt-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
              className={`rounded-md py-2 text-xs font-semibold transition-colors ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              账号密码登录
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => switchMode('register')}
              className={`rounded-md py-2 text-xs font-semibold transition-colors ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              注册新账号
            </button>
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
                  placeholder="例如：admin、smt_op01 或邮箱"
                  className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label
                  htmlFor="auth-display-name"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  操作员姓名（选填）
                </label>
                <div className="relative">
                  <UserPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="auth-display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="例如：张主管 / SMT白班仓管"
                    className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
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
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位字符"
                  className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
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

            {mode === 'register' && (
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
                    className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={signingIn}
              className="mt-1 flex w-full items-center justify-center rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingIn
                ? '正在处理...'
                : mode === 'login'
                  ? '登录工作台'
                  : '注册并进入工作台'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-medium text-slate-400">或使用第三方登录</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={signingIn}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg
              className="h-4 w-4 shrink-0 text-slate-700"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.18v2.92h5.27c-.23 1.48-1.69 4.35-5.27 4.35-3.17 0-5.76-2.63-5.76-5.87s2.59-5.87 5.76-5.87c1.81 0 3.02.77 3.71 1.43l2.53-2.44C16.79 4.1 14.69 3.2 12.17 3.2 7.21 3.2 3.2 7.22 3.2 12.2s4.01 9 8.97 9c5.18 0 8.61-3.64 8.61-8.77 0-.59-.06-1.04-.14-1.33Z"
              />
            </svg>
            <span>使用 Google 账号登录</span>
          </button>

          <div className="mt-5 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">
            首次登录将自动初始化标准 SMT 示例料号、库位、BOM 及 Zebra ZPL 模板数据，所有变更均持久保存。
          </div>
        </div>
      </main>
    </div>
  );
}
