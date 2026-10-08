from ultralytics import YOLO


def main():
    model = YOLO("yolo26n.pt")

    model.train(
        data="dataset/data.yaml",

        epochs=30,
        imgsz=640,
        batch=4,

        patience=10,

        device=0,

        workers=0,
        cache=False,

        amp=True,

        project="C:/IOT/fire_ai/runs/fire_smoke",
        name="yolo26n_final2"
    )


if __name__ == "__main__":
    main()