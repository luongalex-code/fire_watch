/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { FireWatchApp } from './features/firewatch';
import { LoginPage } from './LoginPage';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000').replace(/\/$/, '');

interface AuthUser {
  id: number;
  email: string;
  full_name?: string | null;
  role: string;
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState<AuthUser | null>(null);

  const handleLogin = async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      let message = 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản.';
      try {
        const data = await response.json();
        if (typeof data.detail === 'string') {
          message = data.detail;
        }
      } catch {
        // Keep default message when backend response is not JSON.
      }
      throw new Error(message);
    }

    const data = await response.json();
    setCurrentUser(data.user);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
  };

  return (
    <BrowserRouter>
      {isLoggedIn ? (
        <FireWatchApp currentUser={currentUser} onLogout={handleLogout} />
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </BrowserRouter>
  );
}
