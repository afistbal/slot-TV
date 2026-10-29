import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const source = readFileSync(path.join(root, 'docs/LUCKY_TASKS_API.md'), 'utf8');
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const lines = source.split(/\r?\n/), blocks = [], navigation = [];
let section = 0, lastHeading = '';
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  if (line.startsWith('```')) {
    const code = [];
    while (++i < lines.length && !lines[i].startsWith('```')) code.push(lines[i]);
    const label = lastHeading === '请求参数' ? '复制请求' : lastHeading === '返回数据' ? '复制返回' : '复制 JSON';
    blocks.push('<div class="code"><button type="button" data-copy>' + label + '</button><pre>' + escape(code.join('\n')) + '</pre></div>');
  } else if (/^#{1,3} /.test(line)) {
    const level = line.indexOf(' '), title = line.slice(level + 1);
    lastHeading = title;
    if (level === 2) {
      if (section) blocks.push('</section>');
      section++;
      navigation.push(`<a href="#api-${section}">${escape(title.split(' · ').at(-1))}</a>`);
      const match = title.match(/^(POST|GET) (\S+) · (.+)$/);
      blocks.push(`<section class="api" id="api-${section}"><h2>${match ? `<span class="method ${match[1].toLowerCase()}">${match[1]}</span><code>${escape(match[2])}</code><span class="purpose">${escape(match[3])}</span>` : escape(title)}</h2>`);
    } else blocks.push(`<h${level}>${escape(title)}</h${level}>`);
  } else if (line.startsWith('|')) {
    const table = [];
    do { const cells = lines[i].split('|').slice(1, -1).map(s => s.trim());
      if (!cells.every(s => /^[-: ]+$/.test(s))) table.push(cells);
    } while (++i < lines.length && lines[i].startsWith('|'));
    i--;
    blocks.push('<div class="table"><table border="1" cellpadding="8" cellspacing="0">' + table.map((cells, row) => '<tr>' + cells.map(c => `<${row ? 'td' : 'th'}>${escape(c)}</${row ? 'td' : 'th'}>`).join('') + '</tr>').join('') + '</table></div>');
  } else blocks.push('<p>' + escape(line) + '</p>');
}
if (section) blocks.push('</section>');
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>幸运转盘接口文档</title><style>
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f4f6f9;color:#263245;font:14px/1.75 system-ui,"Microsoft YaHei",sans-serif}.toolbar{position:sticky;top:0;z-index:2;background:#fffffff5;border-bottom:1px solid #dfe5ee;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px}.toolbar strong{font-size:14px}button{border:0;background:#225fc4;color:white;padding:8px 15px;border-radius:6px;cursor:pointer;font:inherit;font-size:12px}main{max-width:1050px;margin:24px auto;padding:0 20px 60px}h1{font-size:25px;margin:20px 0 10px;color:#152a49}h2{display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:17px;margin:0 0 20px;padding-bottom:14px;border-bottom:1px solid #e2e7ef}h2 code{font-family:Consolas,monospace;font-size:16px}.purpose{font-size:14px;color:#607087}h3{font-size:14px;margin:22px 0 8px}p{margin:10px 0;overflow-wrap:anywhere}.api{padding:24px;background:white;border:1px solid #dfe5ee;border-radius:10px;margin-top:20px;scroll-margin-top:75px}.method{font-size:12px;padding:3px 7px;border-radius:4px;background:#e5efff;color:#1e5ba9}.method.get{background:#e7f6ed;color:#27744b}nav{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}nav a{color:#2a598e;border:1px solid #d6e1f0;border-radius:6px;padding:5px 10px;text-decoration:none;background:white}.table{overflow:auto}table{width:100%;border-collapse:collapse;border-color:#dce3ed;font-size:12px;line-height:1.65}td,th{text-align:left;vertical-align:top;border-color:#dce3ed}th{background:#f1f5fb}.code{position:relative;background:#f7f9fc;border:1px solid #e0e6ef;border-radius:7px;margin:8px 0 16px;padding-top:35px}.code button{position:absolute;right:8px;top:7px;padding:3px 10px;background:#e6edf8;color:#245295}.code pre{margin:0;padding:10px 16px 16px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.85 Consolas,monospace}#status{color:#276448;font-size:12px;margin-left:10px}@media(max-width:700px){main{padding:0 10px 40px}.api{padding:16px}.toolbar{padding:10px;flex-wrap:wrap}.toolbar strong{display:none}h2 code{font-size:14px}h1{font-size:23px}}@media print{.toolbar,nav,.code button{display:none}body{background:white}main{max-width:none;margin:0;padding:0}.api{border:0;padding:0;break-before:auto}.code{padding-top:0}table,pre{break-inside:avoid}}
</style></head><body><div class="toolbar"><strong>YogoShort · API</strong><div><button type="button" id="copy-all">复制全文到钉钉</button><span id="status" role="status"></span></div></div><main><nav>${navigation.join('')}</nav><article id="document">${blocks.join('\n')}</article></main><script>
const documentText=${JSON.stringify(source).replaceAll('<', '\\u003c')};
function copied(){document.getElementById('status').textContent='已复制，可粘贴到钉钉';}
async function copy(text,element,rich){
  if(rich&&navigator.clipboard?.write&&typeof ClipboardItem!=='undefined'){
    try{await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([text],{type:'text/plain'}),'text/html':new Blob([rich],{type:'text/html'})})]);copied();return;}catch{}
  }
  if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(text);copied();return;}catch{}}
  const previous=document.activeElement;const input=document.createElement('textarea');input.value=text;input.setAttribute('readonly','');input.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(input);input.focus();input.select();input.setSelectionRange(0,input.value.length);
  let done=false;try{done=document.execCommand('copy');}catch{}input.remove();previous?.focus?.();if(done){copied();return;}
  const range=document.createRange();range.selectNodeContents(element);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);document.getElementById('status').textContent='已选中，请按 Ctrl+C 复制';
}
document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',()=>{const pre=button.parentElement.querySelector('pre');copy(pre.textContent,pre);}));
document.getElementById('copy-all').addEventListener('click',()=>{const article=document.getElementById('document');const clone=article.cloneNode(true);clone.querySelectorAll('button').forEach(b=>b.remove());clone.querySelectorAll('pre').forEach(p=>p.setAttribute('style','white-space:pre-wrap;font:12px/1.8 Consolas,monospace;background:#f7f9fc;padding:12px'));copy(documentText,article,clone.outerHTML);});
</script></body></html>`;
for (const target of [path.join(root, 'docs/lucky-wheel-api.html'), 'D:/JJ-Y/admin/docs/lucky-wheel-api.html']) {
  mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, html);
}
console.log('Generated lucky-wheel-api.html in H5 and admin docs.');
