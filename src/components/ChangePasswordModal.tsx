import { KeyRound, X } from 'lucide-react';
import { useState } from 'react';

interface ChangePasswordModalProps {
  open: boolean;
  username: string;
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
  onClose: () => void;
}

export function ChangePasswordModal({
  open,
  username,
  onSubmit,
  onClose,
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!currentPassword) {
      setError('请输入当前密码');
      return;
    }
    if (newPassword.length < 6) {
      setError('新密码长度不能少于 6 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改密码失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-sky-700" />
            <h2
              id="change-password-title"
              className="font-display text-sm font-semibold text-slate-900"
            >
              修改账号密码（{username}）
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="关闭修改密码弹窗"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              role="status"
              className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"
            >
              密码已更新，下次登录请使用新密码。
            </div>
          )}

          <div>
            <label
              htmlFor="cp-current"
              className="mb-1 block text-xs font-medium text-slate-700"
            >
              当前密码
            </label>
            <input
              id="cp-current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </div>

          <div>
            <label
              htmlFor="cp-new"
              className="mb-1 block text-xs font-medium text-slate-700"
            >
              新密码（至少 6 位）
            </label>
            <input
              id="cp-new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </div>

          <div>
            <label
              htmlFor="cp-confirm"
              className="mb-1 block text-xs font-medium text-slate-700"
            >
              确认新密码
            </label>
            <input
              id="cp-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              关闭
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
            >
              {submitting ? '保存中...' : '确认修改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
