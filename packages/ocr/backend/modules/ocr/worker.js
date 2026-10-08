'use strict';
const { fork } = require('node:child_process'),
  path = require('node:path');
const { randomUUID } = require('node:crypto');
const { AppError } = require('../../shared/errors');
class OcrWorker {
  constructor({
    childPath = path.join(__dirname, 'worker-child.js'),
    timeoutMs = 35000,
    startupMs = 15000,
    maxQueue = 4,
  } = {}) {
    Object.assign(this, { childPath, timeoutMs, startupMs, maxQueue });
    this.queue = [];
    this.active = null;
    this.child = null;
    this.ready = false;
    this.closed = false;
  }
  start() {
    if (this.child || this.closed) return;
    const child = (this.child = fork(this.childPath, [], {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      execArgv: ['--max-old-space-size=256'],
      env: {
        ...Object.fromEntries(
          ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE']
            .filter((key) => process.env[key])
            .map((key) => [key, process.env[key]]),
        ),
        OMP_NUM_THREADS: '1',
        OPENBLAS_NUM_THREADS: '1',
        MALLOC_ARENA_MAX: '2',
      },
    }));
    const startup = setTimeout(() => this.fail(child, 'ENGINE_UNAVAILABLE'), this.startupMs);
    child.on('message', (message) => {
      if (child !== this.child) return;
      if (message.ready) {
        clearTimeout(startup);
        this.ready = true;
        this.capabilities = message.capabilities;
        this.pump();
      } else if (message.startupError) this.fail(child, 'ENGINE_UNAVAILABLE');
      else if (this.active?.id === message.id) {
        const job = this.active;
        this.active = null;
        clearTimeout(job.timer);
        message.error
          ? job.reject(new AppError(422, message.error.code, message.error.message))
          : job.resolve(message.result);
        this.pump();
      }
    });
    child.on('error', () => this.fail(child, 'ENGINE_UNAVAILABLE'));
    child.on('exit', () => {
      clearTimeout(startup);
      if (child === this.child) this.fail(child, 'ENGINE_UNAVAILABLE');
    });
  }
  run(job) {
    if (this.closed)
      return Promise.reject(
        new AppError(503, 'ENGINE_UNAVAILABLE', 'The OCR service is shutting down.'),
      );
    if (this.queue.length >= this.maxQueue)
      return Promise.reject(
        new AppError(503, 'SERVICE_BUSY', 'All extraction slots are busy. Please retry shortly.'),
      );
    return new Promise((resolve, reject) => {
      const item = { id: randomUUID(), job, resolve, reject };
      item.queueTimer = setTimeout(() => {
        const at = this.queue.indexOf(item);
        if (at >= 0) {
          this.queue.splice(at, 1);
          reject(
            new AppError(
              503,
              'SERVICE_BUSY',
              'The extraction queue is busy. Please retry shortly.',
            ),
          );
        }
      }, 15000);
      this.queue.push(item);
      this.start();
      this.pump();
    });
  }
  pump() {
    if (!this.ready || this.active || !this.queue.length) return;
    const job = (this.active = this.queue.shift());
    clearTimeout(job.queueTimer);
    job.timer = setTimeout(() => this.fail(this.child, 'EXTRACTION_TIMEOUT'), this.timeoutMs);
    this.child.send({ id: job.id, job: job.job }, (error) => {
      if (error) this.fail(this.child, 'ENGINE_UNAVAILABLE');
    });
  }
  fail(child, code) {
    if (!child || child !== this.child) return;
    this.child = null;
    this.ready = false;
    child.kill('SIGKILL');
    const active = this.active;
    this.active = null;
    if (active) {
      clearTimeout(active.timer);
      const reject = () =>
        active.reject(
          new AppError(
            503,
            code,
            'Extraction could not finish. Please try a clearer or smaller document.',
          ),
        );
      if (child.exitCode !== null || child.signalCode !== null) reject();
      else child.once('exit', reject);
    }
    for (const job of this.queue.splice(0)) {
      clearTimeout(job.queueTimer);
      job.reject(new AppError(503, code, 'OCR is temporarily unavailable. Please retry shortly.'));
    }
  }
  close() {
    this.closed = true;
    if (this.child) this.fail(this.child, 'ENGINE_UNAVAILABLE');
  }
}
module.exports = { OcrWorker };
