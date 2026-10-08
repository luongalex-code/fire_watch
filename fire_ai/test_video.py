from pathlib import Path
import time

from ultralytics import YOLO


VIDEO_CANDIDATES = [
    Path("test_fire.mp4"),
    Path("video_test/video_test.mp4"),
]

MODELS = {
    "model_cua_ban": "models/best.pt",
    "model_github": "models/github_best.pt",
}

CONF_THRESHOLD = 0.20
IMG_SIZE = 640
OUTPUT_PROJECT = Path("runs/video_test").resolve()
SHOW_VIDEO = True


def find_video():
    for video_path in VIDEO_CANDIDATES:
        if video_path.is_file():
            return video_path

    checked_paths = ", ".join(str(path) for path in VIDEO_CANDIDATES)
    raise FileNotFoundError(f"Khong tim thay video. Da kiem tra: {checked_paths}")


def has_fire_detection(result):
    if result.boxes is None:
        return False

    for class_id in result.boxes.cls.tolist():
        class_name = str(result.names[int(class_id)]).strip().lower()
        if class_name == "fire":
            return True

    return False


def main():
    video = find_video()
    print(f"Video test: {video}")

    for name, weights in MODELS.items():
        if not Path(weights).is_file():
            raise FileNotFoundError(f"Khong tim thay model: {weights}")

        model = YOLO(weights)
        print(f"\nDang test: {name} | Model: {weights} | Classes: {model.names}")

        total_frames = 0
        fire_frames = 0
        start = time.perf_counter()

        results = model.predict(
            source=str(video),
            conf=CONF_THRESHOLD,
            imgsz=IMG_SIZE,
            stream=True,
            save=True,
            show=SHOW_VIDEO,
            project=str(OUTPUT_PROJECT),
            name=name,
            exist_ok=True,
            verbose=False,
        )

        for result in results:
            total_frames += 1
            fire_frames += int(has_fire_detection(result))

        elapsed = time.perf_counter() - start

        print(f"Tong frame: {total_frames}")
        print(f"Frame nhan dien co lua: {fire_frames}")
        print(f"Thoi gian xu ly va luu: {elapsed:.1f} giay")

    print(f"\nVideo ket qua nam trong: {OUTPUT_PROJECT}")


if __name__ == "__main__":
    main()
