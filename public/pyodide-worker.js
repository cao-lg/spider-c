/* 爬虫学堂 · Pyodide Web Worker(module worker)
 * 负责在后台加载 Python 运行时并执行用户代码。
 * 一次性初始化,全局变量在多次运行间保持(方便教学演示)。
 * 需要与 public/pyodide/ 下的自托管运行时配合使用。
 */
import { loadPyodide } from '/pyodide/pyodide.mjs';
import { PRACTICE_DATA } from '/practice-data.js';

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
  // 注入站点根地址,供 requests 拼接同源靶站 URL
  await pyodide.runPython(
    'try:\n' +
      '    import js\n' +
      '    SITE_BASE = js.location.origin\n' +
      'except Exception:\n' +
      '    SITE_BASE = ""\n',
  );
  // 以 JSON 字符串注入,Python 侧 json.loads 转成纯 dict。
  // 直接 set JS 对象会被 Pyodide 转成 JsProxy,其 .get 不可用(曾触发 AttributeError: get)。
  pyodide.globals.set('_PRACTICE_STATIC_JSON', JSON.stringify(PRACTICE_DATA));
  // 给 requests 打补丁:命中预载路径时返回本地 Response,不依赖目标域是否服务静态文件。
  await pyodide.runPython(REQUESTS_PATCH);
  emit('ready', {});
  emit('status', {
    text: `靶站数据已预载(${Object.keys(PRACTICE_DATA).length} 个资源),requests 将直接取用,实操可正常判分。`,
  });
}

// 在 Python 内给 requests 打透明补丁:requests.get / session.get 命中 _PRACTICE_STATIC
// 路径时,返回一份真实的 requests.Response(内容为打包的靶站 HTML/JSON)。
// 这样学生在任何托管域下写 requests.get(...) 都能拿到真实靶站数据用于解析练习。
const REQUESTS_PATCH = `
import json
try:
    _PRACTICE_STATIC = json.loads(_PRACTICE_STATIC_JSON)
except Exception:
    _PRACTICE_STATIC = {}

import requests as __ce_rq
__ce_orig = __ce_rq.sessions.Session.request


def __ce_practice_body(url):
    if not isinstance(url, str):
        return None
    p = url
    i = p.find('?')
    if i != -1:
        p = p[:i]
    if '://' in p:
        try:
            from urllib.parse import urlparse as __up
            p = __up(p).path
        except Exception:
            p = p.split('://', 1)[-1]
            p = p[p.find('/'):] if '/' in p else p
    if not p.startswith('/'):
        p = '/' + p
    p = p.lstrip('/')
    if p and p.endswith('/'):
        p += 'index.html'
    return _PRACTICE_STATIC.get(p)


def __ce_patched(self, method, url, **kwargs):
    m = (method or 'GET').upper()
    body = __ce_practice_body(url)
    if body is not None and m in ('GET', 'HEAD'):
        from requests import Response as __ce_resp
        # 用学生传入的 headers 构造真实的 PreparedRequest,使 r.request.headers
        # 可被 UA/请求头类题目正确校验(否则 r.request 为 None 触发 AttributeError)。
        _prep = __ce_rq.Request(method=m, url=url, headers=kwargs.get('headers')).prepare()
        r = __ce_resp()
        r.status_code = 200
        r._content = body.encode('utf-8')
        r.encoding = 'utf-8'
        r.url = url
        r.headers = {}
        r.request = _prep
        return r
    return __ce_orig(self, method, url, **kwargs)


__ce_rq.sessions.Session.request = __ce_patched
`;

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
