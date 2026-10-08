export type PumpReportedState = boolean | null | undefined;

export interface PumpAutoControllerInputs {
  hasFire: boolean;
  canConfirmNoFire: boolean;
  pumpState: PumpReportedState;
}

interface PumpTimerScheduler {
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(timerId: number): void;
}

const browserTimerScheduler: PumpTimerScheduler = {
  setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimeout: (timerId) => window.clearTimeout(timerId),
};

export class PumpAutoController {
  private pumpOnTimer: number | null = null;
  private pumpOffTimer: number | null = null;
  private pumpOnRequested = false;
  private pumpOffRequested = false;
  private inputs: PumpAutoControllerInputs = {
    hasFire: false,
    canConfirmNoFire: false,
    pumpState: null,
  };
  private disposed = false;

  constructor(
    private readonly pumpOnDelayMs: number,
    private readonly pumpOffDelayMs: number,
    private readonly sendPumpCommand: (action: 'on' | 'off') => Promise<unknown>,
    private readonly timerScheduler: PumpTimerScheduler = browserTimerScheduler
  ) {}

  update(inputs: PumpAutoControllerInputs): void {
    if (this.disposed) return;
    this.inputs = inputs;

    if (inputs.pumpState === true) this.pumpOnRequested = false;
    if (inputs.pumpState === false) this.pumpOffRequested = false;

    if (inputs.hasFire) {
      this.clearPumpOffTimer();
      this.pumpOffRequested = false;
      if (inputs.pumpState !== false) this.clearPumpOnTimer();
      if (inputs.pumpState === false && !this.pumpOnRequested && this.pumpOnTimer === null) {
        this.pumpOnTimer = this.timerScheduler.setTimeout(() => {
          this.pumpOnTimer = null;
          if (
            this.disposed ||
            !this.inputs.hasFire ||
            this.inputs.pumpState !== false ||
            this.pumpOnRequested
          ) {
            return;
          }

          this.pumpOnRequested = true;
          void this.sendPumpCommand('on').catch(() => {
            this.pumpOnRequested = false;
          });
        }, this.pumpOnDelayMs);
      }
      return;
    }

    this.clearPumpOnTimer();
    if (!inputs.canConfirmNoFire) this.clearPumpOffTimer();
    if (
      inputs.canConfirmNoFire &&
      inputs.pumpState === true &&
      !this.pumpOffRequested &&
      this.pumpOffTimer === null
    ) {
      this.pumpOffTimer = this.timerScheduler.setTimeout(() => {
        this.pumpOffTimer = null;
        if (
          this.disposed ||
          !this.inputs.canConfirmNoFire ||
          this.inputs.hasFire ||
          this.inputs.pumpState !== true ||
          this.pumpOffRequested
        ) {
          return;
        }

        this.pumpOffRequested = true;
        void this.sendPumpCommand('off').catch(() => {
          this.pumpOffRequested = false;
        });
      }, this.pumpOffDelayMs);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearPumpOnTimer();
    this.clearPumpOffTimer();
  }

  private clearPumpOnTimer(): void {
    if (this.pumpOnTimer === null) return;
    this.timerScheduler.clearTimeout(this.pumpOnTimer);
    this.pumpOnTimer = null;
    this.pumpOnRequested = false;
  }

  private clearPumpOffTimer(): void {
    if (this.pumpOffTimer === null) return;
    this.timerScheduler.clearTimeout(this.pumpOffTimer);
    this.pumpOffTimer = null;
    this.pumpOffRequested = false;
  }
}
