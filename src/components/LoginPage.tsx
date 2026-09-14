import { useState } from 'react';
import { authService } from '../services/auth';
import { MessageCircle, User, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await authService.login(username, password);
      } else {
        await authService.register(username, password, displayName || username);
      }
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const avatars = ['👤', '👨‍💻', '👩‍🎨', '🧑‍🔬', '👩‍💼', '👨‍🚀', '👩‍🏫', '🦊', '🐱', '🐶', '🦄', '🐼'];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-950 p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4 shadow-lg shadow-blue-500/30">
            <MessageCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">GoTalk</h1>
          <p className="text-gray-400">
            {isLogin ? 'Войдите в свой аккаунт' : 'Создайте новый аккаунт'}
          </p>
        </div>

        {/* Form */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Имя пользователя</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  required
                  minLength={3}
                  maxLength={50}
                  className="w-full bg-gray-800 text-white rounded-xl pl-11 pr-4 py-3 border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Display Name (register only) */}
            {!isLogin && (
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Отображаемое имя</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ваше имя"
                    className="w-full bg-gray-800 text-white rounded-xl pl-11 pr-4 py-3 border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Пароль</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-gray-800 text-white rounded-xl pl-11 pr-4 py-3 border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  {isLogin ? 'Войти' : 'Зарегистрироваться'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Toggle login/register */}
          <div className="mt-6 text-center">
            <span className="text-gray-400 text-sm">
              {isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
            </span>
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="ml-2 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
            >
              {isLogin ? 'Зарегистрироваться' : 'Войти'}
            </button>
          </div>
        </div>

        {/* Demo credentials */}
        <div className="mt-6 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
          <p className="text-xs text-gray-500 text-center mb-2">Демо-доступ (если сервер настроен):</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => {
                setUsername('demo');
                setPassword('demo123');
              }}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors"
            >
              demo / demo123
            </button>
          </div>
        </div>

        {/* Avatar selection (register only) */}
        {!isLogin && (
          <div className="mt-4 p-4 bg-gray-900/50 rounded-xl border border-gray-800">
            <p className="text-sm text-gray-400 mb-3">Выберите аватар:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {avatars.map((avatar) => (
                <button
                  key={avatar}
                  className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-xl transition-colors"
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
