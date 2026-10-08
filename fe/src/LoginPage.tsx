import React, { useState } from 'react';
import './LoginPage.css';

export interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
}

interface ValidationErrors {
  email?: string;
  password?: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [generalError, setGeneralError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      newErrors.email = 'Vui long nhap email';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        newErrors.email = 'Email khong dung dinh dang';
      }
    }

    if (!password) {
      newErrors.password = 'Vui long nhap mat khau';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGeneralError('');

    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      await onLogin(email.trim(), password);
    } catch (err: unknown) {
      if (err instanceof Error && err.message) {
        setGeneralError(err.message);
      } else {
        setGeneralError('Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: undefined }));
    }
    if (generalError) {
      setGeneralError('');
    }
  };

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
    if (errors.password) {
      setErrors((prev) => ({ ...prev, password: undefined }));
    }
    if (generalError) {
      setGeneralError('');
    }
  };

  return (
    <div className="fw-login-root">
      <div className="fw-login-container">
        <div className="fw-login-card">
          <div className="fw-login-header">
            <div className="fw-login-brand-badge">
              <span className="fw-login-status-pip" aria-hidden="true" />
              <span>Fire-Watch Operation System</span>
            </div>

            <div className="fw-login-logo-wrapper" aria-hidden="true">
              <svg
                className="fw-login-logo-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2c1.5 3 4 5 4 8a4 4 0 0 1-8 0c0-3 2.5-5 4-8z" fill="#dc2626" stroke="#dc2626" />
                <path d="M8.5 10a3.5 3.5 0 1 0 7 0c0-1.5-.8-2.8-2-3.5" stroke="#ffffff" />
                <path d="M12 18v3" stroke="#ffffff" />
                <path d="M5 19a10 10 0 0 0 14 0" stroke="#ffffff" />
              </svg>
            </div>

            <h1 className="fw-login-title">Đăng nhập hệ thống</h1>
            <p className="fw-login-subtitle">
              Giám sát, cảnh báo sớm va điều phối hệ thống phòng cháy chữa cháy.
            </p>
          </div>

          {generalError && (
            <div className="fw-login-alert fw-login-alert-error" role="alert">
              <svg
                className="fw-login-alert-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="fw-login-alert-text">{generalError}</p>
            </div>
          )}

          <form className="fw-login-form" onSubmit={handleSubmit} noValidate>
            <div className="fw-login-field">
              <label htmlFor="fw-email" className="fw-login-label">
                Email
              </label>
              <div className="fw-login-input-wrapper">
                <span className="fw-login-input-icon" aria-hidden="true">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </span>
                <input
                  id="fw-email"
                  type="email"
                  className={`fw-login-input ${errors.email ? 'fw-login-input-error' : ''}`}
                  placeholder="admin@firewatch.local"
                  value={email}
                  onChange={handleEmailChange}
                  disabled={isLoading}
                  autoComplete="email"
                  autoFocus
                />
              </div>
              {errors.email && (
                <span className="fw-login-error-text" role="alert">
                  {errors.email}
                </span>
              )}
            </div>

            <div className="fw-login-field">
              <label htmlFor="fw-password" className="fw-login-label">
                Mat khau
              </label>
              <div className="fw-login-input-wrapper">
                <span className="fw-login-input-icon" aria-hidden="true">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="fw-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`fw-login-input fw-login-password-input ${errors.password ? 'fw-login-input-error' : ''}`}
                  placeholder="Nhap mat khau"
                  value={password}
                  onChange={handlePasswordChange}
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="fw-login-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  disabled={isLoading}
                  aria-label={showPassword ? 'An mat khau' : 'Hien mat khau'}
                  title={showPassword ? 'An mat khau' : 'Hien mat khau'}
                >
                  {showPassword ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <span className="fw-login-error-text" role="alert">
                  {errors.password}
                </span>
              )}
            </div>

            <button type="submit" className="fw-login-submit-btn" disabled={isLoading}>
              {isLoading ? (
                <>
                  <svg
                    className="fw-login-spinner"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" stroke="rgba(255, 255, 255, 0.25)" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  <span>Đãng đăng nhập...</span>
                </>
              ) : (
                <span>Đăng nhập</span>
              )}
            </button>
          </form>

          <div className="fw-login-footer">
            <p className="fw-login-footer-text">
              Tai khoan mac dinh: admin@firewatch.local / admin
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
