/* 爬虫学堂 · Pyodide Web Worker(module worker)
 * 负责在后台加载 Python 运行时并执行用户代码。
 * 一次性初始化,全局变量在多次运行间保持(方便教学演示)。
 * 需要与 public/pyodide/ 下的自托管运行时配合使用。
 */
import { loadPyodide } from '/pyodide/pyodide.mjs';

let pyodide = null;
let localPackageNames = null;

const CORE_PACKAGES = ['beautifulsoup4', 'soupsieve', 'lxml', 'html5lib', 'requests'];

function emit(type, payload) {
  postMessage(Object.assign({ type }, payload || {}));
}

async function loadLocalPackageIndex() {
  if (localPackageNames) return localPackageNames;
  try {
    const resp = await fetch('/pyodide/pyodide-lock.json');
    const lock = await resp.json();
    localPackageNames = new Set(Object.keys(lock.packages || {}));
  } catch (e) {
    localPackageNames = new Set();
  }
  return localPackageNames;
}

function extractImports(code) {
  const names = new Set();
  const re = /^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/gm;
  let m;
  while ((m = re.exec(code))) {
    const root = (m[1] || m[2]).split('.')[0];
    if (root) names.add(root);
  }
  return names;
}

async function ensureInit() {
  if (pyodide) return;
  emit('status', { text: '正在启动 Python 运行时(首次约 5~10 秒)…' });
  pyodide = await loadPyodide({ indexURL: '/pyodide/' });
  pyodide.setStdout({ batched: (text) => emit('output', { text: text + '\n', isError: false }) });
  pyodide.setStderr({ batched: (text) => emit('output', { text: text + '\n', isError: true }) });
  emit('status', { text: '正在加载解析库(BeautifulSoup / lxml / requests)…' });
  await pyodide.loadPackage(CORE_PACKAGES);
  await loadLocalPackageIndex();
  emit('ready', {});
}

self.onmessage = async (ev) => {
  const msg = ev.data || {};

  if (msg.type === 'init') {
    try {
      await ensureInit();
    } catch (e) {
      // ensureInit 内部已 emit error;此处兜底
    }
    return;
  }

  if (msg.type === 'run') {
    try {
      await ensureInit();
      // 仅加载代码 import 的、且本地已上传的包,避免访问外网 CDN
      const locals = await loadLocalPackageIndex();
      const wanted = [...extractImports(msg.code)].filter(
        (n) => locals.has(n) && !(n in pyodide.loadedPackages),
      );
      if (wanted.length > 0) {
        emit('status', { text: '加载扩展包: ' + wanted.join(', ') + ' …' });
        await pyodide.loadPackage(wanted);
      }
      await pyodide.runPythonAsync(String(msg.code || ''));
      emit('done', {});
    } catch (e) {
      emit('error', { message: String((e && e.stack) || e) });
    }
  }
};
