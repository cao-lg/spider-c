/* 爬虫学堂 · Pyodide Web Worker(module worker)
 * 负责在后台加载 Python 运行时并执行用户代码。
 * 一次性初始化,全局变量在多次运行间保持(方便教学演示)。
 * 需要与 public/pyodide/ 下的自托管运行时配合使用。
 */
import { loadPyodide } from '/pyodide/pyodide.mjs';

let pyodide = null;
let localPackageNames = null;

const CORE_PACKAGES = ['beautifulsoup4', 'soupsieve', 'lxml', 'html5lib', 'requests'];

// 靶站首屏 URL,用于探测「真实书店页」与「托管网关占位页/反爬」的差异。
const PRACTICE_PROBE = '/practice/level1-books/';

function emit(type, payload) {
  postMessage(Object.assign({ type }, payload || {}));
}

/**
 * 探测靶站是否真的返回了教学数据。
 * 学生代码 requests.get 会打到 SITE_BASE + /practice/...
 * 若返回的是 WorkBuddy「链接不完整 / link incomplete」占位页或非书店内容,
 * 说明靶站静态资源没有被当前托管域正常服务(会被误认为反爬)。
 * 这里给出明确诊断,而不是让学生在解析时报莫名错误。
 * 注意:不与「反爬内容教学」混淆——该教学只讨论 UA/状态码,不写死本项目。
 */
async function probePractice(base) {
  try {
    const resp = await fetch(base + PRACTICE_PROBE, { method: 'GET', credentials: 'same-origin' });
    const text = await resp.text();
    const real = text.includes('知墨书店') || text.includes('热销图书榜');
    const placeholder =
      text.includes('链接不完整') || text.includes('link incomplete') || text.includes('链接缺少必要信息');
    return { ok: resp.ok, real, placeholder, status: resp.status };
  } catch (e) {
    return { ok: false, real: false, placeholder: false, status: 0, error: String(e || e.message || e) };
  }
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
  // 注入站点根地址,供 requests 拼接同源靶站 URL
  await pyodide.runPython(
    'try:\n' +
      '    import js\n' +
      '    SITE_BASE = js.location.origin\n' +
      'except Exception:\n' +
      '    SITE_BASE = ""\n',
  );
  emit('ready', {});
  // 后台探测靶站是否被当前托管域正常服务(不阻塞 ready,失败仅提示)。
  probePractice(SITE_BASE_ORIGIN()).then((r) => {
    if (r.real) {
      emit('status', { text: '靶站可达,实操数据正常。' });
    } else if (r.placeholder) {
      emit('diagnostic', {
        kind: 'target_blocked',
        message:
          '靶站被当前托管网关拦截:返回的是「链接不完整」占位页而非教学数据。' +
          '这不是你的代码问题,而是 /practice/ 静态资源未被当前域名正常服务。' +
          '请确认课程站部署于能公开 /practice/ 静态文件的托管(如 spider-c.pages.dev),' +
          '或重新发布应用。',
      });
    } else {
      emit('diagnostic', {
        kind: 'target_unreachable',
        message:
          `靶站探测失败(status=${r.status ?? '?'}, ${r.error || '非预期内容'})。` +
          '若当前域为云后端网关(crawler-course.app.workbuddy.host),它不服务 /practice/ 静态靶站,请改用能托管静态文件的课程地址。',
      });
    }
  });
}

// 读取 Python 侧注入的 SITE_BASE。由于 ensureInit 已把 location.origin 注入,
// 这里直接从浏览器 location 取,避免跨线程依赖。
function SITE_BASE_ORIGIN() {
  return typeof self !== 'undefined' && typeof self.location !== 'undefined'
    ? self.location.origin
    : typeof location !== 'undefined'
      ? location.origin
      : '';
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
