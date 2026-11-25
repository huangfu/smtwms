import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  setAuthTokenProvider,
  wmsApi,
  type AuthUserProfile,
} from '../services/wmsApi';

interface AuthContextValue {
  user: AuthUserProfile | null;
  loading: boolean;
  signingIn: boolean;
  needsInitialAdmin: boolean;
  authError: string | null;
  clearAuthError: () => void;
  loginWithPassword: (username: string, password: string) => Promise<void>;
  bootstrapInitialAdmin: (input: {
    username: string;
    password: string;
    displayName?: string;
  }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [needsInitialAdmin, setNeedsInitialAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const localTokenRef = useRef<string | null>(null);

  useEffect(() => {
    setAuthTokenProvider(async () => localTokenRef.current);
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([
      wmsApi
        .authBootstrapStatus()
        .then((res) => {
          if (active) setNeedsInitialAdmin(Boolean(res.needsInitialAdmin));
        })
        .catch(() => {
          if (active) setNeedsInitialAdmin(false);
        }),
      wmsApi
        .authMe()
        .then((res) => {
          if (active && res.user) {
            setUser(res.user);
          }
        })
        .catch(() => {
          // No active local cookie session
        }),
    ]).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const loginWithPassword = useCallback(async (username: string, password: string) => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const res = await wmsApi.authLogin({ username, password });
      localTokenRef.current = res.token;
      setUser(res.user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '登录失败，请检查账号和密码。';
      setAuthError(msg);
      throw err;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const bootstrapInitialAdmin = useCallback(
    async (input: { username: string; password: string; displayName?: string }) => {
      setSigningIn(true);
      setAuthError(null);
      try {
        const res = await wmsApi.authBootstrapAdmin(input);
        localTokenRef.current = res.token;
        setNeedsInitialAdmin(false);
        setUser(res.user);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '管理员初始化失败，请稍后重试。';
        setAuthError(msg);
        throw err;
      } finally {
        setSigningIn(false);
      }
    },
    []
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await wmsApi.authChangePassword({ currentPassword, newPassword });
    },
    []
  );

  const signOut = useCallback(async () => {
    setAuthError(null);
    try {
      await wmsApi.authLogout().catch(() => undefined);
    } finally {
      localTokenRef.current = null;
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signingIn,
        needsInitialAdmin,
        authError,
        clearAuthError,
        loginWithPassword,
        bootstrapInitialAdmin,
        changePassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
