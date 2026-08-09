// 爬虫学堂 · Pyodide 运行时管理(主线程)
// 单例 worker,多个 <py-runner> 组件共享同一个 Python 解释器实例。
// 串行执行 + 超时强杀,防止死循环卡死页面。

export interface OutputChunk {
  text: string;
  isError: boolean;
}

export interface RunOptions {
  timeout?: number;
  onStatus?: (status: string) => void;
  onOutput?: (chunk: OutputChunk) => void;
}

export interface RunResult {
  ok: boolean;
  error?: string;
}

let worker: Worker | null = null;
let initPromise: Promise<Worker> | null = null;
let initResolve: ((w: Worker) => void) | null = null;
let initReject: ((e: unknown) => void) | null = null;

let current: {
  resolve: (r: RunResult) => void;
  onStatus?: (s: string) => void;
  onOutput?: (c: OutputChunk) => void;
} | null = null;

let tail: Promise<unknown> = Promise.resolve();

function teardown() {
  worker?.terminate();
  worker = null;
  initPromise = null;
  initResolve = null;
  initReject = null;
}

function ensureWorker(): Promise<Worker> {
  if (worker) return Promise.resolve(worker);
  if (initPromise) return initPromise;

  initPromise = new Promise<Worker>((resolve, reject) => {
    initResolve = resolve;
    initReject = reject;
    let w: Worker;
    try {
      w = new Worker('/pyodide-worker.js', { type: 'module' });
    } catch (e) {
      initPromise = null;
      initResolve = null;
      initReject = null;
      reject(e);
      return;
    }
    worker = w;

    w.onmessage = (ev) => {
      const m = ev.data || {};
      switch (m.type) {
        case 'ready': {
          const r = initResolve;
          initResolve = null;
          initReject = null;
          r?.(w);
          break;
        }
        case 'status':
          current?.onStatus?.(m.text);
          break;
        case 'output':
          current?.onOutput?.({ text: m.text, isError: !!m.isError });
          break;
        case 'error': {
          const err = new Error(m.message ?? 'Python 运行出错');
          if (initResolve) {
            const r = initReject;
            initResolve = null;
            initReject = null;
            worker = null;
            initPromise = null;
            r?.(err);
          } else {
            current?.onOutput?.({ text: m.message, isError: true });
            current?.resolve({ ok: false, error: m.message });
          }
          break;
        }
        case 'done':
          current?.resolve({ ok: true });
          break;
      }
    };

    w.onerror = (e) => {
      const msg = e.message || 'Worker 进程出错';
      if (initResolve) {
        const r = initReject;
        initResolve = null;
        initReject = null;
        worker = null;
        initPromise = null;
        r?.(new Error(msg));
      } else {
        teardown();
        current?.onOutput?.({ text: msg, isError: true });
        current?.resolve({ ok: false, error: msg });
      }
    };

    w.postMessage({ type: 'init' });
  });

  return initPromise;
}

async function executeRun(code: string, opts: RunOptions): Promise<RunResult> {
  const workerInstance = await ensureWorker();
  const timeoutMs = opts.timeout ?? 45000;

  return new Promise<RunResult>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      current = null;
      const msg = `运行超时(超过 ${Math.round(timeoutMs / 1000)} 秒),已终止进程。请检查是否有死循环。`;
      teardown();
      opts.onOutput?.({ text: msg, isError: true });
      resolve({ ok: false, error: msg });
    }, timeoutMs);

    current = {
      resolve: (r) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        current = null;
        resolve(r);
      },
      onStatus: opts.onStatus,
      onOutput: opts.onOutput,
    };

    workerInstance.postMessage({ type: 'run', code });
  });
}

/** 串行执行一段 Python 代码 */
export function runPython(code: string, opts: RunOptions = {}): Promise<RunResult> {
  const p = tail.then(() => executeRun(code, opts));
  tail = p.catch(() => {});
  return p;
}
