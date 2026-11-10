// 轻量代码编辑器 —— 零依赖替换 <pre contenteditable>
//
// 为什么换:
//   1. contenteditable 里的回车行为随浏览器而异,textContent 会丢换行,判题因此偶发失败;
//   2. 没有撤销栈、粘贴富文本会带样式、Tab 只能靠已废弃的 document.execCommand;
//   3. 中文输入法下光标位置容易错乱。
//
// 方案:透明 <textarea> 负责"输入与光标",背后一层 <pre> 负责"高亮显示",两层用同一套
// 字体度量与内边距对齐,滚动位置双向同步。这是 CodeMirror 之前最经典的实现思路,
// 优点是零依赖、离线可用、原生支持撤销/粘贴/输入法。

const KEYWORDS = new Set([
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def', 'del', 'elif',
  'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda',
  'None', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'False', 'try', 'while',
  'with', 'yield',
]);

const BUILTINS = new Set([
  'print', 'len', 'range', 'int', 'str', 'float', 'bool', 'list', 'dict', 'set', 'tuple', 'open',
  'enumerate', 'zip', 'sum', 'min', 'max', 'sorted', 'type', 'isinstance', 'super', 'repr',
  'format', 'abs', 'round', 'any', 'all', 'getattr', 'hasattr', 'globals', 'locals',
]);

const TOKEN_RE =
  /("""[\s\S]*?"""|'''[\s\S]*?'''|#[^\n]*|f?"(?:[^"\\\n]|\\.)*"|f?'(?:[^'\\\n]|\\.)*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b|\s+|[^\s])/g;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 把源码转成带 span 的高亮 HTML(输入是纯文本,先逐 token 转义) */
export function highlightPython(code: string): string {
  let out = '';
  // 每次调用使用独立的正则实例,避免共享 lastIndex 造成状态污染
  const re = new RegExp(TOKEN_RE.source, 'g');
  let m: RegExpExecArray | null;
  let lastIndex = 0;
  while ((m = re.exec(code))) {
    const tok = m[0];
    // 中间若有未匹配字符(理论上不会),原样补上
    if (m.index > lastIndex) out += escapeHtml(code.slice(lastIndex, m.index));
    lastIndex = m.index + tok.length;

    if (tok.startsWith('#')) {
      out += `<span class="tok-com">${escapeHtml(tok)}</span>`;
    } else if (tok.startsWith('"""') || tok.startsWith("'''") || /^f?["']/.test(tok)) {
      out += `<span class="tok-str">${escapeHtml(tok)}</span>`;
    } else if (/^\d/.test(tok)) {
      out += `<span class="tok-num">${escapeHtml(tok)}</span>`;
    } else if (/^[A-Za-z_]/.test(tok)) {
      const prev = code[m.index - 1] ?? '';
      const after = code.slice(m.index + tok.length).match(/^\s*/)?.[0] ?? '';
      const nextChar = code[m.index + tok.length + after.length] ?? '';
      if (prev === '.') {
        out += `<span class="tok-prop">${escapeHtml(tok)}</span>`;
      } else if (KEYWORDS.has(tok)) {
        out += `<span class="tok-kw">${escapeHtml(tok)}</span>`;
      } else if (nextChar === '(') {
        out += `<span class="tok-fn">${escapeHtml(tok)}</span>`;
      } else if (BUILTINS.has(tok)) {
        out += `<span class="tok-bi">${escapeHtml(tok)}</span>`;
      } else {
        out += escapeHtml(tok);
      }
    } else {
      out += escapeHtml(tok);
    }
  }
  if (lastIndex < code.length) out += escapeHtml(code.slice(lastIndex));
  return out;
}

export interface CodeEditorOptions {
  value: string;
  readOnly?: boolean;
  /** Ctrl/Cmd + Enter 触发 */
  onRun?: () => void;
  label?: string;
  minRows?: number;
}

export interface CodeEditor {
  element: HTMLElement;
  getValue(): string;
  setValue(v: string): void;
  focus(): void;
  setReadOnly(v: boolean): void;
}

const INDENT = '    ';

export function createCodeEditor(opts: CodeEditorOptions): CodeEditor {
  const root = document.createElement('div');
  root.className = 'code-editor';

  const gutter = document.createElement('div');
  gutter.className = 'ce-gutter';
  gutter.setAttribute('aria-hidden', 'true');

  const body = document.createElement('div');
  body.className = 'ce-body';

  const highlight = document.createElement('pre');
  highlight.className = 'ce-highlight';
  highlight.setAttribute('aria-hidden', 'true');
  const codeEl = document.createElement('code');
  highlight.appendChild(codeEl);

  const input = document.createElement('textarea');
  input.className = 'ce-input';
  input.spellcheck = false;
  input.wrap = 'off';
  input.autocapitalize = 'off';
  input.autocomplete = 'off';
  input.setAttribute('autocorrect', 'off');
  input.value = opts.value;
  input.setAttribute('aria-label', opts.label ?? 'Python 代码编辑器');
  if (opts.readOnly) input.readOnly = true;

  body.appendChild(highlight);
  body.appendChild(input);
  root.appendChild(gutter);
  root.appendChild(body);

  const minRows = opts.minRows ?? 4;

  function paint() {
    // 结尾补一个换行,避免最后一行空行时高亮层高度不足
    codeEl.innerHTML = highlightPython(input.value + '\n');
    const lines = input.value.split('\n').length;
    let nums = '';
    for (let i = 1; i <= lines; i++) nums += `<div>${i}</div>`;
    gutter.innerHTML = nums;
    applyReadOnly();
    grow();
    syncScroll();
  }

  function applyReadOnly() {
    root.classList.toggle('is-readonly', input.readOnly);
    input.setAttribute('aria-readonly', String(input.readOnly));
  }

  function grow() {
    const lineHeight = parseFloat(getComputedStyle(input).lineHeight) || 22;
    const minH = lineHeight * minRows;
    input.style.height = 'auto';
    input.style.height = `${Math.max(minH, input.scrollHeight)}px`;
  }

  function syncScroll() {
    // 横向:高亮层随 textarea 左移;纵向:整体上移
    codeEl.style.transform = `translate(${-input.scrollLeft}px, ${-input.scrollTop}px)`;
    gutter.style.transform = `translateY(${-input.scrollTop}px)`;
  }

  input.addEventListener('input', paint);
  input.addEventListener('scroll', syncScroll);

  input.addEventListener('keydown', (e) => {
    const hasMod = e.ctrlKey || e.metaKey;
    if (hasMod && e.key === 'Enter') {
      e.preventDefault();
      opts.onRun?.();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (input.readOnly) return;
      const { selectionStart, selectionEnd, value } = input;

      if (e.shiftKey) {
        // 反缩进:整行(或多行)去掉最多 4 个前导空格
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        const block = value.slice(lineStart, selectionEnd);
        const dedented = block.replace(new RegExp(`^${INDENT}`, 'gm'), '');
        input.setRangeText(dedented, lineStart, selectionEnd, 'select');
        input.selectionStart = Math.max(lineStart, selectionStart - INDENT.length);
        input.selectionEnd = Math.max(lineStart, selectionEnd - (block.length - dedented.length));
      } else if (selectionStart !== selectionEnd) {
        // 多行缩进
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        const block = value.slice(lineStart, selectionEnd);
        const indented = block.replace(/^/gm, INDENT);
        input.setRangeText(indented, lineStart, selectionEnd, 'select');
      } else {
        input.setRangeText(INDENT, selectionStart, selectionEnd, 'end');
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey && !hasMod) {
      if (input.readOnly) return;
      const { selectionStart, value } = input;
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const currentLine = value.slice(lineStart, selectionStart);
      const lead = currentLine.match(/^[ \t]*/)?.[0] ?? '';
      const extra = /[:(\[{]\s*$/.test(currentLine.trimEnd()) ? INDENT : '';
      if (lead || extra) {
        e.preventDefault();
        input.setRangeText(`\n${lead}${extra}`, selectionStart, input.selectionEnd, 'end');
      }
    }

    // 单引号/双引号/括号自动补全
    const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
    const closer = pairs[e.key];
    if (closer && !input.readOnly && input.selectionStart === input.selectionEnd) {
      const pos = input.selectionStart;
      const nextChar = input.value[pos] ?? '';
      if (!nextChar || /[\s)\]},"']/.test(nextChar)) {
        e.preventDefault();
        input.setRangeText(e.key + closer, pos, pos, 'end');
        input.selectionStart = input.selectionEnd = pos + 1;
      }
    }
  });

  // 粘贴时去掉富文本格式,只保留纯文本
  input.addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text/plain');
    if (text == null) return;
    e.preventDefault();
    const { selectionStart, selectionEnd } = input;
    input.setRangeText(text.replace(/\r\n/g, '\n'), selectionStart, selectionEnd, 'end');
  });

  paint();

  return {
    element: root,
    getValue: () => input.value,
    setValue: (v: string) => {
      input.value = v;
      input.scrollTop = 0;
      input.scrollLeft = 0;
      paint();
    },
    focus: () => input.focus(),
    setReadOnly: (v: boolean) => {
      input.readOnly = v;
      applyReadOnly();
    },
  };
}
