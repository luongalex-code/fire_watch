export function modelLabel(path?: string | null): string {
  if (!path) return 'Chưa có dữ liệu';
  const file = path.replace(/\\/g, '/').split('/').pop()?.toLowerCase();
  if (file === 'best.pt') return 'YOLO26n · Lửa/khói tự train';
  if (file === 'github_best.pt') return 'YOLOv8n · Lửa/khói';
  if (file === 'yolov8n.pt') return 'YOLOv8n · Người';
  return path;
}
