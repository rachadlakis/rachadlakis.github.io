const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Reveal animation on scroll
const io = new IntersectionObserver((es) => {
  es.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  });
}, { threshold: .12 });

document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.transitionDelay = (i % 6 * 40) + 'ms';
  io.observe(el);
});

// Theme toggle
function toggleTheme() {
  const html = document.documentElement;
  const btn = document.querySelector('.theme-toggle');
  if (html.getAttribute('data-theme') === 'light') {
    html.removeAttribute('data-theme');
    btn.textContent = '☀️';
    localStorage.setItem('theme', 'dark');
  } else {
    html.setAttribute('data-theme', 'light');
    btn.textContent = '🌙';
    localStorage.setItem('theme', 'light');
  }
  readPalette();
}

// Load saved theme
(function() {
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch (e) {}
  const btn = document.querySelector('.theme-toggle');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    btn.textContent = '🌙';
  }
})();

// Palette read from CSS tokens, so the canvas follows the theme
let palette = { a: [74, 144, 217], b: [90, 209, 255] };
function hexToRgb(hex) {
  const h = hex.trim().replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function readPalette() {
  const cs = getComputedStyle(document.documentElement);
  palette = { a: hexToRgb(cs.getPropertyValue('--accent')), b: hexToRgb(cs.getPropertyValue('--accent-2')) };
}
readPalette();
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// ---------- Neural network background ----------
(function neuralBackground() {
  if (REDUCED_MOTION) return;
  const cv = document.createElement('canvas');
  cv.id = 'neural-bg';
  document.body.prepend(cv);
  const ctx = cv.getContext('2d');
  const LINK = 150;
  const mouse = { x: -9999, y: -9999 };
  let W, H, nodes = [], pulses = [];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.width = innerWidth * dpr;
    H = cv.height = innerHeight * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    W /= dpr; H /= dpr;
    const count = Math.min(90, Math.round(W * H / 16000));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25,
      r: Math.random() * 1.6 + .8, act: 0
    }));
    pulses = [];
  }

  function neighbors(n) {
    return nodes.filter(m => m !== n && Math.hypot(m.x - n.x, m.y - n.y) < LINK);
  }

  function firePulse(from) {
    const ns = neighbors(from || nodes[(Math.random() * nodes.length) | 0]);
    if (!ns.length) return;
    const src = from || ns[0];
    pulses.push({ a: src, b: ns[(Math.random() * ns.length) | 0], t: 0, hops: 3 });
  }

  function frame() {
    ctx.clearRect(0, 0, W, H);
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
      const dm = Math.hypot(n.x - mouse.x, n.y - mouse.y);
      if (dm < 180) n.act = Math.max(n.act, 1 - dm / 180);
      n.act *= .96;
    }
    // edges
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < LINK) {
          const w = (1 - d / LINK) * (.18 + Math.max(a.act, b.act) * .5);
          ctx.strokeStyle = rgba(palette.a, w);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      // cursor acts as an input neuron
      const n = nodes[i], dm = Math.hypot(n.x - mouse.x, n.y - mouse.y);
      if (dm < 180) {
        ctx.strokeStyle = rgba(palette.b, (1 - dm / 180) * .35);
        ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
      }
    }
    // pulses travelling along edges (forward pass)
    pulses = pulses.filter(p => {
      p.t += .025;
      const x = p.a.x + (p.b.x - p.a.x) * p.t, y = p.a.y + (p.b.y - p.a.y) * p.t;
      ctx.fillStyle = rgba(palette.b, .9);
      ctx.shadowColor = rgba(palette.b, 1); ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
      if (p.t >= 1) {
        p.b.act = 1;
        if (p.hops > 0) {
          const ns = neighbors(p.b).filter(m => m !== p.a);
          if (ns.length) pulses.push({ a: p.b, b: ns[(Math.random() * ns.length) | 0], t: 0, hops: p.hops - 1 });
        }
        return false;
      }
      return true;
    });
    // nodes
    for (const n of nodes) {
      ctx.fillStyle = rgba(n.act > .05 ? palette.b : palette.a, .35 + n.act * .65);
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r + n.act * 2, 0, 7); ctx.fill();
    }
    if (Math.random() < .03 && pulses.length < 12) firePulse();
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  addEventListener('mouseout', () => { mouse.x = mouse.y = -9999; });
  addEventListener('click', e => {
    // clicking fires a burst from the nearest neuron
    let best = null, bd = 1e9;
    for (const n of nodes) { const d = Math.hypot(n.x - e.clientX, n.y - e.clientY); if (d < bd) { bd = d; best = n; } }
    if (best && bd < 200) for (let k = 0; k < 4; k++) firePulse(best);
  });
  resize();
  requestAnimationFrame(frame);
})();

// ---------- Decode effect on page titles ----------
(function decodeTitle() {
  if (REDUCED_MOTION) return;
  const h1 = document.querySelector('h1');
  if (!h1) return;
  const GLYPHS = '01<>/{}[]=+*#%&$∑∂λσ∇';
  const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
  const texts = [];
  while (walker.nextNode()) texts.push({ node: walker.currentNode, orig: walker.currentNode.nodeValue });
  const total = texts.reduce((s, t) => s + t.orig.length, 0);
  let frame = 0;
  const steps = 28;
  (function tick() {
    const revealed = Math.floor((frame / steps) * total);
    let idx = 0;
    for (const t of texts) {
      t.node.nodeValue = [...t.orig].map(ch => {
        const out = idx++ < revealed || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        return out;
      }).join('');
    }
    if (frame++ < steps) setTimeout(tick, 35);
    else texts.forEach(t => t.node.nodeValue = t.orig);
  })();
})();

// ---------- Token-streaming eyebrow ----------
(function streamEyebrow() {
  const el = document.querySelector('[data-stream]');
  if (!el || REDUCED_MOTION) return;
  const phrases = el.dataset.stream.split('|');
  const text = document.createElement('span');
  const caret = document.createElement('span');
  caret.className = 'stream-caret';
  el.textContent = '';
  el.append(text, caret);
  let p = 0;
  function type(phrase) {
    const toks = phrase.split(/(\s+)/);
    text.textContent = '';
    let i = 0;
    (function next() {
      if (i < toks.length) {
        const s = document.createElement('span');
        s.className = 'tok';
        s.textContent = toks[i++];
        text.append(s);
        setTimeout(next, 70 + Math.random() * 90);
      } else setTimeout(erase, 2400);
    })();
  }
  function erase() {
    (function back() {
      if (text.lastChild) { text.lastChild.remove(); setTimeout(back, 30); }
      else { p = (p + 1) % phrases.length; setTimeout(() => type(phrases[p]), 300); }
    })();
  }
  type(phrases[0]);
})();

// ---------- Spotlight cards ----------
document.querySelectorAll('.proj, .quick-link').forEach(card => {
  card.addEventListener('pointermove', e => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    card.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
});

// ---------- Scroll progress bar ----------
(function scrollProgress() {
  const bar = document.createElement('div');
  bar.id = 'train-bar';
  document.body.append(bar);
  function update() {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, scrollY / max) : 1;
    bar.style.width = (p * 100) + '%';
  }
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
})();

// ---------- Ask rachad.ai (in-browser retrieval over the CV) ----------
(function askAI() {
  const KB = [
    { id: 'about', src: 'index.html', k: 'who about rachad summary yourself introduce background profile overview hi hello hey',
      a: "I'm Rachad Lakis, a **Machine Learning Engineer** with **dual Master's degrees** (Data Science + Computer Science) and **two IEEE publications**. I work across the full AI stack: PyTorch, distributed training (DDP/FSDP), LLM fine-tuning, computer vision, RAG, and agentic systems." },
    { id: 'experience', src: 'experience.html', k: 'experience work job jobs career companies worked employer roles current devtech argus unifyapps prisma',
      a: "Recent roles:\n• **devtech.pro**: AI Consultant / Data Scientist (2023–now)\n• **UnifyApps (DGE)**: AI Architect & Consultant\n• **Argus**: ML Engineer, fire/smoke & firearm detection\n• **Prisma**: chatbot-as-a-service with RAG\n• **Robots Go Mental**: GTL + LLaMA/BERT fine-tuning\n\nFull timeline → [Experience](experience.html)" },
    { id: 'distributed', src: 'projects.html', k: 'distributed ddp fsdp multi gpu multigpu omni train training zero scale parallel',
      a: "**OMNI-Train** is my multi-GPU training framework (CLI + web app) in PyTorch: **DDP & FSDP**, bf16 mixed precision, gradient checkpointing, layer prefetching, PEFT, and quantization, for training models that exceed single-GPU memory.\n→ [GitHub](https://github.com/rachadlakis/omni-train)" },
    { id: 'llm', src: 'experience.html', k: 'llm llama bert fine tune tuning finetuning gtl transfer language model lora qlora peft',
      a: "I fine-tuned **LLaMA 3.2-1B and BERT in pure PyTorch** (no fine-tuning libraries) at Robots Go Mental, applying **Guided Transfer Learning** to train better with limited data, and ran experiments on AWS SageMaker. I also use LoRA/QLoRA, PEFT, and bitsandbytes." },
    { id: 'cv', src: 'projects.html', k: 'vision computer cv yolo detection object detr image images threat fire smoke firearm opencv',
      a: "Computer vision is a core area for me:\n• **Threat detection**: YOLOv12 + RF-DETR on a **120K+ image** dataset\n• Fire/smoke & firearm detection at **Argus**\n• **Age recognition** from pose-estimation keypoints (IEEE 2023)\n• Motion detection and face-emotion recognition" },
    { id: 'agents', src: 'projects.html', k: 'agent agents agentic rag mcp chatbot chatbots a2a octopus retrieval vector qdrant pydantic',
      a: "Agentic & RAG work:\n• **Octopus AI**: an orchestrator plus 5 specialist agents over the **A2A protocol** (PydanticAI)\n• RAG chatbots with chunking, embeddings, and **Qdrant**/pgvector\n• **MCP** and function-calling integrations that let bots act on APIs and databases\n\n(Fun fact: this chat is a tiny keyword-retrieval system running in your browser.)" },
    { id: 'projects', src: 'projects.html', k: 'projects project portfolio built build side github code',
      a: "Highlights: **Octopus AI** (multi-agent A2A), **OMNI-Train** (DDP/FSDP), **Threat Detection** (YOLOv12 + RF-DETR), **MNIST from scratch** in pure NumPy, and a **3rd-place** finish in the Klangoo Fintech NLP competition.\n→ [All projects](projects.html)" },
    { id: 'education', src: 'education.html', k: 'education study degree degrees master masters university school usj liu thesis bachelor',
      a: "• **MSc Data Science**, USJ (ESIB), 2021–23, average 16.5/20, thesis 18/20\n• **MSc Computer Science**, LIU, 2016–18, GPA 3.8/4.0\n• **BS Computer Science**, LIU\n→ [Education](education.html)" },
    { id: 'pubs', src: 'publications.html', k: 'publication publications paper papers research ieee published pose tfidf tf-idf',
      a: "Two IEEE papers:\n• **\"Pose Estimation Keypoints in Age Recognition of Full Body Image\"**, IEEE IMCET 2023\n• **\"Improved TFIDF Weighting Techniques in Document Retrieval\"**, IEEE ICDIM 2018\n→ [Publications](publications.html)" },
    { id: 'skills', src: 'skills.html', k: 'skills stack tools tech technologies languages python pytorch tensorflow know frameworks',
      a: "Core stack: **Python, PyTorch**, Hugging Face, Ultralytics, TensorFlow, scikit-learn, OpenCV · **DDP, FSDP, ZeRO**, LoRA/QLoRA · **RAG, MCP**, Qdrant · pandas, SQL, Neo4j.\n→ [Skills](skills.html)" },
    { id: 'contact', src: 'index.html', k: 'contact email reach hire hiring phone linkedin available talk',
      a: "Let's talk!\n• Email: [rachadlakis@gmail.com](mailto:rachadlakis@gmail.com)\n• [LinkedIn](https://www.linkedin.com/in/rachad-lakis/) · [GitHub](https://github.com/rachadlakis)\n• Phone: +961 3 962 918" },
    { id: 'cv-file', src: 'Rachad_Lakis_CV.pdf', k: 'cv resume pdf download',
      a: "Here's the full CV as a PDF → [Rachad_Lakis_CV.pdf](Rachad_Lakis_CV.pdf)" },
    { id: 'languages', src: 'publications.html', k: 'speak spoken arabic english french language languages',
      a: "Arabic (native), English (fluent), French (intermediate)." },
    { id: 'scratch', src: 'projects.html', k: 'scratch numpy backprop backpropagation mnist fundamentals math',
      a: "I like knowing what's under the hood: I built **MNIST digit recognition in pure Python + NumPy**, with hand-written matrix math for backprop and gradient descent. No frameworks." }
  ];
  const SUGGESTIONS = ['Who is Rachad?', 'Distributed training?', 'Agents & RAG', 'Computer vision work', 'Publications', 'How to contact?'];
  const STOP = new Set('the a an is are you your do does did what which who how of in on to for and or with me my i about tell can have has any'.split(' '));

  const tokenize = s => s.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
  const stem = w => w.replace(/(ing|ed|s)$/, '');

  function retrieve(q) {
    const qt = tokenize(q).map(stem);
    if (!qt.length) return null;
    let best = null, bestScore = 0;
    for (const d of KB) {
      const dk = d.k.split(' ').map(stem);
      let s = 0;
      for (const t of qt) if (dk.some(k => k === t || (t.length > 3 && k.startsWith(t)))) s++;
      const score = s / qt.length;
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return bestScore > 0 ? { doc: best, score: bestScore } : null;
  }

  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const md = s => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\[(.+?)\]\((.+?)\)/g, (_, t, u) => `<a href="${u}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`);

  // UI
  const fab = document.createElement('button');
  fab.id = 'ai-fab';
  fab.setAttribute('aria-label', 'Ask rachad.ai');
  fab.innerHTML = '<span class="orb"></span><span>Ask <span class="lbl-long">rachad.</span>ai</span><kbd>Ctrl K</kbd>';
  const panel = document.createElement('div');
  panel.id = 'ai-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Ask rachad.ai');
  panel.innerHTML = `
    <div class="ai-head"><span class="orb"></span><span class="t">rachad.ai</span><span class="s">local · private</span><button aria-label="Close">×</button></div>
    <div class="ai-log"></div>
    <div class="ai-sugg"></div>
    <form class="ai-form"><input placeholder="Ask about my experience, projects…" aria-label="Your question" autocomplete="off"><button type="submit">Send</button></form>`;
  document.body.append(fab, panel);
  const log = panel.querySelector('.ai-log');
  const input = panel.querySelector('input');
  const sugg = panel.querySelector('.ai-sugg');
  SUGGESTIONS.forEach(s => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = s;
    b.onclick = () => ask(s);
    sugg.append(b);
  });

  let greeted = false, busy = false;
  const queue = [];
  function open() {
    panel.classList.add('open');
    input.focus();
    if (!greeted) { greeted = true; botSay("Hi! I'm a small assistant indexed on Rachad's CV. Ask me about experience, projects, research, or skills. Try `/theme` or `/cv` too.", null); }
  }
  function close() { panel.classList.remove('open'); }
  fab.onclick = () => panel.classList.contains('open') ? close() : open();
  panel.querySelector('.ai-head button').onclick = close;
  addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); panel.classList.contains('open') ? close() : open(); }
    if (e.key === 'Escape') close();
  });
  panel.querySelector('form').onsubmit = e => { e.preventDefault(); ask(input.value); };

  function add(cls, html) {
    const m = document.createElement('div');
    m.className = 'ai-msg ' + cls;
    m.innerHTML = html;
    log.append(m);
    log.scrollTop = log.scrollHeight;
    return m;
  }

  function botSay(text, meta) {
    busy = true;
    const m = add('bot', '<span class="ai-thinking"><i></i><i></i><i></i></span>');
    const toks = text.split(/(\s+)/);
    const t0 = performance.now();
    setTimeout(() => {
      let i = 0, acc = '';
      (function next() {
        if (i < toks.length) {
          acc += toks[i++];
          m.innerHTML = md(acc).replace(/`(.+?)`/g, '<b>$1</b>');
          log.scrollTop = log.scrollHeight;
          setTimeout(next, REDUCED_MOTION ? 0 : 18 + Math.random() * 30);
        } else {
          const ms = Math.round(performance.now() - t0);
          const tps = (toks.filter(t => t.trim()).length / (ms / 1000)).toFixed(0);
          if (meta) m.insertAdjacentHTML('beforeend', `<span class="ai-meta">${meta} · ${tps} tok/s</span>`);
          busy = false;
          if (queue.length) ask(queue.shift());
        }
      })();
    }, REDUCED_MOTION ? 0 : 450 + Math.random() * 300);
  }

  function ask(q) {
    q = q.trim();
    if (!q) return;
    input.value = '';
    if (busy) { queue.push(q); return; }
    add('user', esc(q));
    const cmd = q.toLowerCase();
    if (cmd === '/theme') { toggleTheme(); return botSay('Theme switched. ✨', 'command'); }
    if (cmd === '/cv') return botSay(KB.find(d => d.id === 'cv-file').a, 'command');
    if (cmd === '/help') return botSay('Commands: `/theme`, `/cv`, `/help`. Or just ask anything about Rachad.', 'command');
    const hit = retrieve(q);
    if (hit) botSay(hit.doc.a, `retrieved: ${hit.doc.src} · score ${hit.score.toFixed(2)}`);
    else botSay("I couldn't find that in the CV index. Try asking about **experience**, **projects**, **distributed training**, **LLMs**, **computer vision**, **publications**, or **contact**.", 'no match');
  }
})();
