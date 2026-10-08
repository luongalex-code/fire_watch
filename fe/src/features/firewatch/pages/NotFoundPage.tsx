import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto min-h-[50vh]">
      <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 mb-4 shadow-sm">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-xl font-bold text-slate-900 mb-1">404 - Không tìm thấy trang</h1>
      <p className="text-xs text-slate-500 mb-6 leading-relaxed">
        Phần hệ hoặc tuyen dieu huong ban yeu cau khong ton tai trong hệ thống dieu hanh tac chien FireWatch.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Quay ve Trang Tổng quan</span>
      </Link>
    </div>
  );
};
