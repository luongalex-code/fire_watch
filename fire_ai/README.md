# Fire AI

Dự án phát hiện **lửa** và **khói** từ webcam bằng Ultralytics YOLO. Chương trình phát hiện lửa theo thời gian thực, hiển thị trạng thái trên khung hình và lưu ảnh khi có sự kiện lửa.

> Đây là dự án thử nghiệm/tham khảo, không thay thế hệ thống báo cháy hoặc thiết bị an toàn đã được chứng nhận.

## Yêu cầu

- Windows và Python 3.10 trở lên.
- Webcam được kết nối và cho phép ứng dụng truy cập.
- Gói Python `ultralytics` và `opencv-python`.
- GPU NVIDIA/CUDA nếu muốn huấn luyện bằng cấu hình hiện tại. Chạy phát hiện có thể dùng CPU nhưng sẽ chậm hơn.

## Cài đặt

Mở PowerShell tại thư mục dự án:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install ultralytics opencv-python
```

PyTorch thường được cài cùng Ultralytics. Nếu cần dùng CUDA để huấn luyện, hãy cài phiên bản PyTorch phù hợp với driver và CUDA trên máy theo hướng dẫn cài đặt chính thức của PyTorch.

## Chạy phát hiện lửa bằng webcam

Đảm bảo đã có trọng số `models/best.pt`, mở PowerShell tại thư mục `fire_ai`, sau đó chạy:

```powershell
python detect_fire.py
```

- Mặc định tự thử camera theo thứ tự `1, 2, 0, 3, 4, 5`; mỗi camera được thử với các backend Windows `DSHOW`, `MSMF` và `ANY`.
- Khi phát hiện lửa liên tiếp đủ số khung hình xác nhận, chương trình hiển thị `FIRE DETECTED`.
- Ảnh khung hình có chú thích được lưu trong `captures/`, tối đa một ảnh mỗi 5 giây trong lúc trạng thái báo lửa đang bật.
- Nhấn `Ctrl+C` trên cửa sổ camera để thoát.

Để ép chương trình dùng camera rời ở index `1`, chạy trong PowerShell:

```powershell
$env:FIRE_AI_CAMERA_CANDIDATES = "1"
python detect_fire.py
```

Thay `"1"` bằng index camera rời trên máy của bạn (`0`, `1`, `2`, ...). Nếu không chỉ định biến này, chương trình tự dò các index mặc định ở trên. Đóng các ứng dụng khác đang sử dụng camera nếu thiết bị không mở được.

## Kiểm tra camera và YOLO

```powershell
python camera_test.py
```

Mở webcam để kiểm tra hình ảnh, không chạy mô hình. Nhấn `Q` để thoát.

```powershell
python yolo_test.py
```

Chạy thử `yolo26n.pt` trực tiếp trên webcam với ngưỡng tin cậy `0.5`. Script này không dùng trọng số đã huấn luyện trong `models/best.pt`.

## Huấn luyện

Cấu hình dataset nằm trong `dataset/data.yaml`, gồm hai lớp `Fire` và `Smoke`, với các tập `train`, `valid` và `test`. Chạy:

```powershell
python train.py
```

Script khởi tạo từ `yolo26n.pt`, huấn luyện 30 epoch ở kích thước ảnh 640 và lưu kết quả dưới `runs/fire_smoke/yolo26n_final2/`. Trọng số tốt nhất thường nằm tại:

```text
runs/fire_smoke/yolo26n_final2/weights/best.pt
```

Để dùng trọng số mới trong `detect_fire.py`, chép `best.pt` vào `models/best.pt`. Cấu hình hiện tại của `train.py` đặt `device=0` (GPU thứ nhất) và đường dẫn đầu ra tuyệt đối `C:/IOT/fire_ai`; nếu thư mục dự án hoặc cấu hình phần cứng khác, hãy cập nhật các giá trị này trong script trước khi huấn luyện.

## Cấu trúc chính

```text
fire_ai/
├── camera_test.py       # Kiểm tra webcam
├── detect_fire.py       # Phát hiện lửa bằng trọng số đã huấn luyện
├── train.py             # Huấn luyện mô hình
├── yolo_test.py         # Thử YOLO trên webcam
├── yolo26n.pt           # Trọng số khởi tạo
├── models/best.pt       # Trọng số dùng cho detect_fire.py
├── dataset/             # Ảnh, nhãn và cấu hình dataset
├── captures/            # Ảnh sự kiện được lưu khi chạy
└── runs/                 # Kết quả huấn luyện Ultralytics
```

Dataset đi kèm có thông tin giấy phép **CC BY 4.0** trong `dataset/data.yaml`; hãy xem `dataset/README.dataset.txt` và `dataset/README.roboflow.txt` trước khi phân phối hoặc sử dụng dataset.