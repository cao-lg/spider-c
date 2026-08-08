// 爬虫学堂 · <py-runner> 自定义元素
// 用法: <py-runner title="示例" code="print(1)"></py-runner>
//       <py-runner title="示例"><pre>print(1)</pre></py-runner>   (取第一个 pre 文本)
// 支持交互编辑、Ctrl+Enter 运行、Tab 缩进、重置。

import { runPython } from './runner-runtime';

function extractDefaultCode(el: HTMLElement): string {
  const pre =
    el.querySelector<HTMLPreElement>('.py-runner-source') ??
    el.querySelector<HTMLPreElement>('pre');
  if (pre) return pre.textContent?.replace(/^\n+/, '').replace(/\s+$/, '') ?? '';
  return el.getAttribute('code') ?? '';
}

class PyRunner extends HTMLElement {
  private rootEl!: HTMLElement;
  private editorEl!: HTMLPreElement;
  private consoleEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private runBtn!: HTMLButtonElement;
  private resetBtn!: HTMLButtonElement;
  private defaultCode = '';
  private readonly = false;

  connectedCallback() {
    if (this.dataset.built) return;
    this.dataset.built = '1';
    this.build();
  }

  private build() {
    this.defaultCode = extractDefaultCode(this);
    this.readonly = this.getAttribute('readonly') === 'true';
    const title = this.getAttribute('title') || 'Python 示例';

    this.innerHTML = '';

    this.rootEl = document.createElement('div');
    this.rootEl.className = 'py-runner';

    const head = document.createElement('div');
    head.className = 'py-runner-head';

    const titleEl = document.createElement('span');
    titleEl.className = 'py-runner-title';
    titleEl.textContent = title;
    head.appendChild(titleEl);

    const actions = document.createElement('div');
    actions.className = 'py-runner-actions';

    this.resetBtn = document.createElement('button');
    this.resetBtn.className = 'btn sm py-runner-reset';
    this.resetBtn.textContent = '重置';
    actions.appendChild(this.resetBtn);

    this.runBtn = document.createElement('button');
    this.runBtn.className = 'btn primary sm py-runner-run';
    this.runBtn.textContent = '▶ 运行';
    actions.appendChild(this.runBtn);

    head.appendChild(actions);
    this.rootEl.appendChild(head);

    this.editorEl = document.createElement('pre');
    this.editorEl.className = 'py-runner-editor';
    this.editorEl.setAttribute('contenteditable', String(!this.readonly));
    this.editorEl.setAttribute('spellcheck', 'false');
    this.editorEl.textContent = this.defaultCode;
    this.rootEl.appendChild(this.editorEl);

    this.consoleEl = document.createElement('div');
    this.consoleEl.className = 'py-runner-console';
    this.consoleEl.style.display = 'none';
    this.rootEl.appendChild(this.consoleEl);

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'py-runner-status';
    this.statusEl.textContent = this.readonly ? '' : '点击「运行」执行代码,支持 Ctrl+Enter。';
    this.rootEl.appendChild(this.statusEl);

    this.appendChild(this.rootEl);
    this.bind();
  }

  private bind() {
    this.runBtn.addEventListener('click', () => this.run());
    this.resetBtn.addEventListener('click', () => {
      this.editorEl.textContent = this.defaultCode;
      this.setStatus('已重置为示例代码。');
    });
    this.editorEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.run();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        document.execCommand('insertText', false, '    ');
      }
    });
  }

  private clearConsole() {
    this.consoleEl.textContent = '';
    this.consoleEl.style.display = 'none';
  }

  private log(text: string, isError = false) {
    this.consoleEl.style.display = 'block';
    const line = document.createElement('div');
    if (isError) line.className = 'err';
    line.textContent = text;
    this.consoleEl.appendChild(line);
    this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
  }

  private setStatus(text: string) {
    this.statusEl.textContent = text;
  }

  private async run() {
    const code = this.editorEl.textContent ?? '';
    this.runBtn.disabled = true;
    this.resetBtn.disabled = true;
    this.rootEl.classList.add('py-runner-busy');
    this.clearConsole();
    const start = performance.now();

    const result = await runPython(code, {
      onStatus: (s) => this.setStatus(s),
      onOutput: (c) => this.log(c.text, c.isError),
    });

    this.runBtn.disabled = false;
    this.resetBtn.disabled = false;
    this.rootEl.classList.remove('py-runner-busy');

    if (result.ok) {
      this.setStatus(`✔ 运行完成,用时 ${((performance.now() - start) / 1000).toFixed(2)} 秒`);
    } else {
      this.setStatus('✘ 运行出错,请检查代码并重试');
    }
  }
}

customElements.define('py-runner', PyRunner);
