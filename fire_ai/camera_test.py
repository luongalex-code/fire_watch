import os

import cv2

CAMERA_INDEX = int(os.getenv("FIRE_AI_CAMERA_INDEX", "1"))

cap = cv2.VideoCapture(
    CAMERA_INDEX,
    cv2.CAP_DSHOW
)

if not cap.isOpened():
    print("Khong mo duoc USB webcam")
    exit()

print("USB webcam da mo thanh cong")
print("Nhan Q de thoat")

while True:
    ret, frame = cap.read()

    if not ret:
        print("Khong doc duoc frame")
        break

    cv2.imshow(
        "USB WEBCAM",
        frame
    )

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
