import assert from 'node:assert/strict';
import test from 'node:test';
import { PumpAutoController } from './pumpAutoController';

class FakeTimers {
  private now = 0;
  private nextId = 0;
  private readonly timers = new Map<number, { at: number; callback: () => void }>();

  setTimeout(callback: () => void, delayMs: number): number {
    const id = ++this.nextId;
    this.timers.set(id, { at: this.now + delayMs, callback });
    return id;
  }

  clearTimeout(timerId: number): void {
    this.timers.delete(timerId);
  }

  advanceBy(delayMs: number): void {
    const end = this.now + delayMs;
    while (true) {
      const due = [...this.timers.entries()]
        .filter(([, timer]) => timer.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      this.now = due[1].at;
      this.timers.delete(due[0]);
      due[1].callback();
    }
    this.now = end;
  }
}

const tickMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

test('delays pump on and cancels it when fire clears before the delay', async () => {
  const timers = new FakeTimers();
  const commands: string[] = [];
  const controller = new PumpAutoController(4000, 4000, async (action) => commands.push(action), timers);

  controller.update({ hasFire: true, canConfirmNoFire: false, pumpState: false });
  timers.advanceBy(3999);
  assert.deepEqual(commands, []);
  controller.update({ hasFire: false, canConfirmNoFire: true, pumpState: false });
  timers.advanceBy(1);
  assert.deepEqual(commands, []);
  controller.dispose();
});

test('turns pump on exactly once after fire persists for the on delay', async () => {
  const timers = new FakeTimers();
  const commands: string[] = [];
  const controller = new PumpAutoController(4000, 4000, async (action) => commands.push(action), timers);

  controller.update({ hasFire: true, canConfirmNoFire: false, pumpState: false });
  timers.advanceBy(3999);
  assert.deepEqual(commands, []);
  timers.advanceBy(1);
  await tickMicrotasks();
  controller.update({ hasFire: true, canConfirmNoFire: false, pumpState: false });
  timers.advanceBy(4000);
  await tickMicrotasks();
  assert.deepEqual(commands, ['on']);
  controller.dispose();
});

test('ADC above the clear threshold with flameFireDetected false starts pump-off delay', async () => {
  const timers = new FakeTimers();
  const commands: string[] = [];
  const controller = new PumpAutoController(4000, 5000, async (action) => commands.push(action), timers);

  controller.update({ hasFire: false, canConfirmNoFire: true, pumpState: true });
  timers.advanceBy(2000);
  controller.update({ hasFire: true, canConfirmNoFire: false, pumpState: true });
  timers.advanceBy(5000);
  assert.deepEqual(commands, []);

  controller.update({ hasFire: false, canConfirmNoFire: true, pumpState: true });
  timers.advanceBy(4999);
  assert.deepEqual(commands, []);
  timers.advanceBy(1);
  await tickMicrotasks();
  assert.deepEqual(commands, ['off']);
  controller.dispose();
});

test('runs repeated off-on-off cycles without retaining request flags from a prior cycle', async () => {
  const timers = new FakeTimers();
  const commands: string[] = [];
  const controller = new PumpAutoController(3000, 5000, async (action) => commands.push(action), timers);

  controller.update({ hasFire: true, canConfirmNoFire: false, pumpState: false });
  timers.advanceBy(3000);
  await tickMicrotasks();
  assert.deepEqual(commands, ['on']);

  controller.update({ hasFire: true, canConfirmNoFire: false, pumpState: true });
  controller.update({ hasFire: false, canConfirmNoFire: true, pumpState: true });
  timers.advanceBy(5000);
  await tickMicrotasks();
  assert.deepEqual(commands, ['on', 'off']);

  controller.update({ hasFire: false, canConfirmNoFire: true, pumpState: false });
  controller.update({ hasFire: true, canConfirmNoFire: false, pumpState: false });
  timers.advanceBy(3000);
  await tickMicrotasks();
  assert.deepEqual(commands, ['on', 'off', 'on']);

  controller.update({ hasFire: true, canConfirmNoFire: false, pumpState: true });
  controller.update({ hasFire: false, canConfirmNoFire: true, pumpState: true });
  timers.advanceBy(5000);
  await tickMicrotasks();
  assert.deepEqual(commands, ['on', 'off', 'on', 'off']);
  controller.dispose();
});

test('resets the completed OFF request when a new fire cycle begins', async () => {
  const timers = new FakeTimers();
  const commands: string[] = [];
  const controller = new PumpAutoController(1000, 1000, async (action) => commands.push(action), timers);

  controller.update({ hasFire: false, canConfirmNoFire: true, pumpState: true });
  timers.advanceBy(1000);
  await tickMicrotasks();
  assert.deepEqual(commands, ['off']);

  controller.update({ hasFire: true, canConfirmNoFire: false, pumpState: true });
  controller.update({ hasFire: false, canConfirmNoFire: true, pumpState: true });
  timers.advanceBy(1000);
  await tickMicrotasks();
  assert.deepEqual(commands, ['off', 'off']);
  controller.dispose();
});

test('retries a failed transition on the next sensor update without locking the next cycle', async () => {
  const timers = new FakeTimers();
  let attempts = 0;
  const controller = new PumpAutoController(1000, 1000, async (action) => {
    if (action === 'off' && attempts++ === 0) throw new Error('command failed');
  }, timers);

  controller.update({ hasFire: false, canConfirmNoFire: true, pumpState: true });
  timers.advanceBy(1000);
  await tickMicrotasks();
  controller.update({ hasFire: false, canConfirmNoFire: true, pumpState: true });
  timers.advanceBy(1000);
  await tickMicrotasks();
  assert.equal(attempts, 2);
  controller.dispose();
});

test('clears both scheduled transitions when the provider unmounts', async () => {
  const timers = new FakeTimers();
  const commands: string[] = [];
  const controller = new PumpAutoController(1000, 1000, async (action) => commands.push(action), timers);

  controller.update({ hasFire: true, canConfirmNoFire: false, pumpState: false });
  controller.dispose();
  timers.advanceBy(1000);
  await tickMicrotasks();
  assert.deepEqual(commands, []);
});
