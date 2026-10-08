export function formatAdcValue(val: number | null | undefined): string {
  if (val === null || val === undefined) return 'Chưa có dữ liệu';
  return `${val.toLocaleString()} ADC`;
}

export function formatTemperature(val: number | null | undefined): string {
  if (val === null || val === undefined) return 'Chưa có dữ liệu';
  return `${val.toFixed(1)} °C`;
}

export function formatHumidity(val: number | null | undefined): string {
  if (val === null || val === undefined) return 'Chưa có dữ liệu';
  return `${val.toFixed(1)} %`;
}

export function formatConfidence(conf: number | null | undefined): string {
  if (conf === null || conf === undefined) return 'N/A';
  return `${(conf * 100).toFixed(1)}%`;
}

export function getSeverityLabel(severity: string): { text: string; bg: string; textCol: string; border: string } {
  switch (severity) {
    case 'critical':
      return { text: 'MỨC CAO', bg: 'bg-red-900/40', textCol: 'text-red-400', border: 'border-red-600' };
    case 'warning':
      return { text: 'MUC TRUNG BINH', bg: 'bg-amber-900/40', textCol: 'text-amber-400', border: 'border-amber-600' };
    case 'info':
      return { text: 'HE THONG', bg: 'bg-blue-900/40', textCol: 'text-blue-400', border: 'border-blue-600' };
    default:
      return { text: 'MUC THAP', bg: 'bg-slate-800', textCol: 'text-slate-300', border: 'border-slate-700' };
  }
}

export function getStatusLabel(status: string): { text: string; bg: string; textCol: string } {
  switch (status) {
    case 'new':
      return { text: 'Mới phát hiện', bg: 'bg-red-500/20', textCol: 'text-red-400' };
    case 'acknowledged':
      return { text: 'Đã tiếp nhận', bg: 'bg-blue-500/20', textCol: 'text-blue-400' };
    case 'resolved':
      return { text: 'Đã kết thúc', bg: 'bg-slate-500/20', textCol: 'text-slate-400' };
    default:
      return { text: status, bg: 'bg-slate-700', textCol: 'text-slate-300' };
  }
}

export function getConditionLabel(status: string): { text: string; bg: string; textCol: string } {
  switch (status) {
    case 'active':
      return { text: 'Điều kiện đang active', bg: 'bg-red-500/20', textCol: 'text-red-400' };
    case 'cleared':
      return { text: 'Điều kiện cảnh báo da het', bg: 'bg-emerald-500/20', textCol: 'text-emerald-400' };
    default:
      return { text: 'Chua xac dinh', bg: 'bg-slate-500/20', textCol: 'text-slate-400' };
  }
}
