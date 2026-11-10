// 爬虫学堂 · <py-runner> 自定义元素
// 三种 variant:
//   - showcase: 演示型,代码默认完整可见(用于老师讲解/概念演示)
//   - guided:   引导型,代码默认折叠,显示任务说明,学生点开才看到
//   - challenge:挑战型,starter 含 TODO,默认折叠,鼓励学生先动手
// 用法: <py-runner title="示例" variant="guided" code="print(1)" prompt="任务..."></py-runner>

import { runPython } from './runner-runtime';
import { createCodeEditor, type CodeEditor } from './code-editor';

function extractDefaultCode(el: HTMLElement): string {
  const pre =
    el.querySelector<HTMLPreElement>('.py-runner-source') ?? el.querySelector<HTMLPreElement>('pre');
  if (pre) return pre.textContent?.replace(/^\n+/, '').replace(/\s+$/, '') ?? '';
  return el.getAttribute('code') ?? '';
}

type Variant = 'showcase' | 'guided' | 'challenge';

class PyRunner extends HTMLElement {
  private rootEl!: HTMLElement;
  private editor!: CodeEditor;
  private codeWrapEl!: HTMLElement;
  private consoleEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private runBtn!: HTMLButtonElement;
  private resetBtn!: HTMLButtonElement;
  private revealBtn: HTMLButtonElement | null = null;
  private defaultCode = '';
  private readonly = false;
  private variant: Variant = 'showcase';
  private promptText = '';
  private starterTodoCount = 0;
  private revealed = false;

  connectedCallback() {
    if (this.dataset.built) return;
    this.dataset.built = '1';
    this.build();
  }

  private build() {
    this.defaultCode = extractDefaultCode(this);
    this.readonly = this.getAttribute('data-readonly') === 'true';
    const attr = (k: string) => this.getAttribute(k) ?? this.getAttribute(`data-${k}`) ?? '';
    const title = attr('title') || attr('data-title') || 'Python 示例';
    const v = (attr('variant') || attr('data-variant') || 'showcase') as Variant;
    this.variant = v === 'guided' || v === 'challenge' ? v : 'showcase';
    this.promptText = attr('prompt') || attr('data-prompt');
    this.starterTodoCount = (this.defaultCode.match(/#\s*TODO\b/g) ?? []).length;
    this.revealed = this.variant === 'showcase';

    this.innerHTML = '';

    this.rootEl = document.createElement('div');
    this.rootEl.className = `py-runner py-runner-${this.variant}`;

    const head = document.createElement('div');
    head.className = 'py-runner-head';

    const titleEl = document.createElement('span');
    titleEl.className = 'py-runner-title';
    titleEl.textContent = title;
    head.appendChild(titleEl);

    const actions = document.createElement('div');
    actions.className = 'py-runner-actions';

    this.resetBtn = document.createElement('button');
    this.resetBtn.type = 'button';
    this.resetBtn.className = 'btn sm py-runner-reset';
    this.resetBtn.textContent = '重置';
    actions.appendChild(this.resetBtn);

    this.runBtn = document.createElement('button');
    this.runBtn.type = 'button';
    this.runBtn.className = 'btn primary sm py-runner-run';
    this.runBtn.textContent = '▶ 运行';
    actions.appendChild(this.runBtn);

    head.appendChild(actions);
    this.rootEl.appendChild(head);

    if (this.promptText && this.variant !== 'showcase') {
      const promptEl = document.createElement('div');
      promptEl.className = 'py-runner-prompt';
      promptEl.innerHTML = `<strong>📋 任务</strong>:${this.promptText}`;
      this.rootEl.appendChild(promptEl);
    }

    if (this.variant === 'challenge' && this.starterTodoCount > 0) {
      const note = document.createElement('div');
      note.className = 'py-runner-note';
      note.innerHTML = `<strong>🎯 学习节奏</strong>:① 先想清楚思路 → ② 填入 <code># TODO</code> 处 → ③ 点击「运行」验证`;
      this.rootEl.appendChild(note);
    } else if (this.variant === 'showcase') {
      const note = document.createElement('div');
      note.className = 'py-runner-note showcase';
      note.innerHTML = `<strong>💡 演示代码</strong> — 这是讲师示范代码,不要只是「点击运行」就完事;试试修改参数,观察输出变化。`;
      this.rootEl.appendChild(note);
    }

    this.codeWrapEl = document.createElement('div');
    this.codeWrapEl.className = 'py-runner-code-wrap';

    this.editor = createCodeEditor({
      value: this.defaultCode,
      readOnly: this.readonly,
      label: `${title} 代码编辑器`,
      onRun: () => void this.run(),
      minRows: 3,
    });

    if (this.variant !== 'showcase') {
      const details = document.createElement('details');
      details.className = 'py-runner-details';
      const summary = document.createElement('summary');
      this.revealBtn = document.createElement('button');
      this.revealBtn.type = 'button';
      this.revealBtn.className = 'btn sm py-runner-reveal';
      this.revealBtn.textContent =
        this.variant === 'challenge' ? '查看参考代码(先自己尝试)' : '展开代码';
      summary.appendChild(this.revealBtn);
      details.appendChild(summary);
      const codeHolder = document.createElement('div');
      codeHolder.className = 'py-runner-code-holder';
      codeHolder.appendChild(this.editor.element);
      details.appendChild(codeHolder);
      this.codeWrapEl.appendChild(details);
    } else {
      this.codeWrapEl.appendChild(this.editor.element);
    }
    this.rootEl.appendChild(this.codeWrapEl);

    this.consoleEl = document.createElement('div');
    this.consoleEl.className = 'py-runner-console';
    this.consoleEl.style.display = 'none';
    this.consoleEl.setAttribute('aria-live', 'polite');
    this.rootEl.appendChild(this.consoleEl);

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'py-runner-status';
    this.statusEl.setAttribute('role', 'status');
    this.statusEl.textContent = this.readonly
      ? '代码为只读示例。'
      : '点击「运行」执行代码,支持 Ctrl+Enter。';
    this.rootEl.appendChild(this.statusEl);

    this.appendChild(this.rootEl);
    this.bind();
  }

  private bind() {
    this.runBtn.addEventListener('click', () => void this.run());
    this.resetBtn.addEventListener('click', () => {
      this.editor.setValue(this.defaultCode);
      this.clearConsole();
      this.setStatus('已重置为初始代码。');
    });
    if (this.revealBtn) {
      const details = this.codeWrapEl.querySelector('details');
      this.revealBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!details) return;
        details.open = !details.open;
        this.revealed = details.open;
        this.revealBtn!.textContent = this.revealed
          ? this.variant === 'challenge'
            ? '收起参考代码'
            : '收起代码'
          : this.variant === 'challenge'
            ? '查看参考代码(先自己尝试)'
            : '展开代码';
        if (this.revealed) this.editor.focus();
      });
    }
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
    if (this.variant !== 'showcase') {
      const details = this.codeWrapEl.querySelector('details');
      const open = details ? details.open : this.revealed;
      if (!open) {
        this.setStatus('⚠ 请先展开代码或自己写一些内容再运行');
        return;
      }
    }
    const code = this.editor.getValue();
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

if (!customElements.get('py-runner')) customElements.define('py-runner', PyRunner);
