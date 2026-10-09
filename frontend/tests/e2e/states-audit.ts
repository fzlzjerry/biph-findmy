// Interaction-state audit: really hovers, keyboard-focuses and presses every control, then measures text contrast
// against the composited background, whether keyboard focus is visible, and whether a selected toggle or tab stays
// readable under the pointer. EN and ZH. Run against a seeded local server (see playwright.config.ts for the env):
//   AUDIT_BASE=http://localhost:8765 AUDIT_OUT=/tmp/audit node --experimental-strip-types tests/e2e/states-audit.ts
// AUDIT_LANGS=en (or zh) audits one language; AUDIT_CHROME points at a Chromium binary if Playwright's is missing.
import { chromium, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:8765";
const OUT = process.env.AUDIT_OUT ?? "/tmp/audit";
const CSRF = { "X-Requested-With": "findmy" };
mkdirSync(OUT, { recursive: true });

type Pg = { name: string; path: string; as?: string; setup?: (p: Page) => Promise<void> };

const PAGES: Pg[] = [
  { name: "home", path: "/" },
  { name: "browse", path: "/browse" },
  { name: "about", path: "/about" },
  { name: "login", path: "/login" },
  { name: "404", path: "/nope" },
  { name: "item", path: "ITEM" },
  { name: "report-lost", path: "/report/lost", as: "student.demo@findmy.local" },
  { name: "report-found", path: "/report/found", as: "student.demo@findmy.local" },
  { name: "me", path: "/me", as: "student.demo@findmy.local" },
  { name: "item-own", path: "OWNITEM", as: "student.demo@findmy.local" },
  { name: "admin", path: "/admin", as: "desk.demo@findmy.local" },
  { name: "admin-stats", path: "/admin?tab=stats", as: "desk.demo@findmy.local" },
  { name: "quick-add", path: "/admin/quick-add", as: "desk.demo@findmy.local" },
];

const SELECTOR =
  'a[href], button, input:not([type=hidden]), textarea, select, [role=tab], [role=radio], [role=checkbox], [role=switch], [role=menuitem], [role=option], [tabindex="0"]:not([role=tablist]), summary';

// Runs in the page: contrast of el's text vs its composited background, plus focus-ring signature.
const MEASURE = `(el) => {
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) { const o = c.match(/oklch|oklab|color\\(/); return o ? null : [0,0,0,0]; }
    const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return [p[0],p[1],p[2],p.length>3?p[3]:1]; };
  const toRgb = (c) => { const cv = document.createElement('canvas'); cv.width = cv.height = 1; const x = cv.getContext('2d');
    x.clearRect(0,0,1,1); x.fillStyle = c; x.fillRect(0,0,1,1); const d = x.getImageData(0,0,1,1).data; return [d[0],d[1],d[2],d[3]/255]; };
  const col = (c) => parse(c) ?? toRgb(c);
  const over = (top, bot) => { const a = top[3] + bot[3]*(1-top[3]); if (!a) return [0,0,0,0];
    return [0,1,2].map(i => (top[i]*top[3] + bot[i]*bot[3]*(1-top[3]))/a).concat([a]); };
  const lum = (c) => { const f = (v) => { v/=255; return v<=0.03928? v/12.92 : ((v+0.055)/1.055)**2.4; }; return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]); };
  // background: stack of ancestor backgrounds, composited bottom-up over white
  const stack = []; let n = el; let gradient = false;
  while (n && n.nodeType === 1) { const s = getComputedStyle(n); if (s.backgroundImage && s.backgroundImage !== 'none' && !s.backgroundImage.startsWith('url')) gradient = true;
    stack.push(col(s.backgroundColor)); n = n.parentElement; }
  let bg = [255,255,255,1]; for (let i = stack.length-1; i>=0; i--) bg = over(stack[i], bg);
  // text colour: the element's own, or of its first visible text-bearing descendant
  let tn = el; const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let t; while ((t = walker.nextNode())) { if (t.textContent.trim()) { tn = t.parentElement; break; } }
  const ts = getComputedStyle(tn); let fg = col(ts.color);
  // composite text alpha and ancestor opacity onto bg
  let op = 1; let m = tn; while (m && m.nodeType === 1) { op *= Number(getComputedStyle(m).opacity); if (m === el) break; m = m.parentElement; }
  // background between tn and el
  const inner = []; let k = tn; while (k && k !== el) { inner.push(col(getComputedStyle(k).backgroundColor)); k = k.parentElement; }
  for (let i = inner.length-1; i>=0; i--) bg = over(inner[i], bg);
  fg = over([fg[0],fg[1],fg[2],fg[3]*op], bg);
  const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
  const s = getComputedStyle(el);
  const hasText = !!(el.innerText||'').trim() || (el.tagName==='INPUT' && el.value);
  return { ratio: Math.round(ratio*100)/100, fg: fg.slice(0,3).map(Math.round).join(','), bg: bg.slice(0,3).map(Math.round).join(','), hasText, gradient,
    // an outline only counts if it actually paints: outline-none leaves outline-style none even when width and colour change
    ring: [s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 ? s.outlineStyle + s.outlineWidth + s.outlineColor : 'no-outline', s.boxShadow, s.borderColor].join('|'),
    bgOwn: s.backgroundColor, opacity: s.opacity };
}`;

async function login(page: Page, email: string) {
  const r = await page.request.post(`${BASE}/api/auth/request-code`, { headers: CSRF, data: { email } });
  const { dev_code } = await r.json();
  await page.request.post(`${BASE}/api/auth/verify`, { headers: CSRF, data: { email, code: dev_code } });
}

async function settle(page: Page, ms = 350) {
  await page.waitForTimeout(ms);
}

type Finding = { page: string; lang: string; label: string; state: string; ratio?: number; fg?: string; bg?: string; issue: string; shot?: string };

async function main() {
  const browser = await chromium.launch(process.env.AUDIT_CHROME ? { executablePath: process.env.AUDIT_CHROME } : {});
  const findings: Finding[] = [];
  let checked = 0;
  for (const lang of (process.env.AUDIT_LANGS ?? "en,zh").split(",")) {
    for (const pg of PAGES) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: lang === "en" ? "en-US" : "zh-CN" });
      const page = await ctx.newPage();
      await page.addInitScript((l) => { try { localStorage.setItem("findmy.lang", l); localStorage.setItem("i18nextLng", l); } catch {} }, lang);
      if (pg.as) await login(page, pg.as);
      let path = pg.path;
      if (path === "ITEM" || path === "OWNITEM") {
        const r = await page.request.get(`${BASE}/api/${path === "ITEM" ? "items?limit=1" : "me/items"}`);
        const j = await r.json().catch(() => ({}));
        const list = j.items ?? j.lost ?? j ?? [];
        const first = Array.isArray(list) ? list[0] : undefined;
        const id = first?.id ?? first?.item?.id;
        if (!id) { console.log("no item for", pg.name, JSON.stringify(j).slice(0, 200)); await ctx.close(); continue; }
        path = `/items/${id}`;
      }
      await page.goto(BASE + path, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await settle(page, 500);
      const handles = await page.$$(SELECTOR);
      const seen = new Set<string>();
      for (const [i, h] of handles.entries()) {
        const box = await h.boundingBox();
        if (!box || box.width < 2 || box.height < 2) continue;
        // close any menu or popover a previous control opened (Radix hides the rest of the page while one is open)
        if (await page.$('[role=menu],[role=dialog],[role=listbox]')) { await page.keyboard.press("Escape"); await settle(page); }
        const vis = await h.evaluate((e) => { const s = getComputedStyle(e); return s.visibility !== "hidden" && s.display !== "none" && !(e as HTMLElement).closest("[inert],[aria-hidden=true]") && !(e as HTMLButtonElement).disabled; });
        if (!vis) continue;
        const label = await h.evaluate((e) => {
          const t = ((e as HTMLElement).innerText || e.getAttribute("aria-label") || (e as HTMLInputElement).placeholder || e.getAttribute("name") || e.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
          return `${e.tagName.toLowerCase()}${e.getAttribute("role") ? "[" + e.getAttribute("role") + "]" : ""}${e.getAttribute("aria-selected") === "true" || e.getAttribute("aria-pressed") === "true" || e.getAttribute("aria-current") || e.getAttribute("aria-checked") === "true" || e.getAttribute("data-state") === "checked" ? "*" : ""} "${t}"`;
        });
        const sig = label + (await h.evaluate((e) => e.className)).toString().slice(0, 300);
        if (seen.has(sig)) continue;
        seen.add(sig);
        checked++;
        try {
          await h.scrollIntoViewIfNeeded();
          await page.mouse.move(1, 1);
          await page.evaluate(() => (document.activeElement as HTMLElement)?.blur?.());
          await settle(page);
          const rest = await h.evaluate(new Function("return " + MEASURE)() as (e: Element) => any);
          const states: Record<string, any> = { rest };
          // hover with the real pointer
          const b2 = (await h.boundingBox())!;
          await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
          await settle(page);
          states.hover = await h.evaluate(new Function("return " + MEASURE)() as (e: Element) => any);
          const hoverShot = async () => {
            const f = `${OUT}/${lang}-${pg.name}-${i}-hover.png`;
            const bb = (await h.boundingBox())!;
            await page.screenshot({ path: f, clip: { x: Math.max(0, bb.x - 24), y: Math.max(0, bb.y - 24), width: bb.width + 48, height: bb.height + 48 } });
            return f;
          };
          let hShot: string | undefined;
          if (rest.hasText && states.hover.ratio < 4.5 && !states.hover.gradient) hShot = await hoverShot();
          // press (mouse down, then leave before releasing so no click fires)
          const popup = await h.evaluate((e) => e.hasAttribute("aria-haspopup"));
          if (!popup) await page.mouse.down();
          await settle(page, 250);
          states.active = await h.evaluate(new Function("return " + MEASURE)() as (e: Element) => any);
          let aShot: string | undefined;
          if (rest.hasText && states.active.ratio < 4.5 && !states.active.gradient) {
            const bb = (await h.boundingBox())!;
            aShot = `${OUT}/${lang}-${pg.name}-${i}-active.png`;
            await page.screenshot({ path: aShot, clip: { x: Math.max(0, bb.x - 24), y: Math.max(0, bb.y - 24), width: bb.width + 48, height: bb.height + 48 } });
          }
          await page.mouse.move(1, 1);
          if (!popup) await page.mouse.up();
          await page.evaluate(() => (document.activeElement as HTMLElement)?.blur?.());
          await settle(page);
          // keyboard focus: a key press first makes programmatic focus count as :focus-visible
          await page.keyboard.press("Shift");
          await h.focus();
          await settle(page);
          states.focus = await h.evaluate(new Function("return " + MEASURE)() as (e: Element) => any);
          const fv = await h.evaluate((e) => e.matches(":focus-visible"));
          let fShot: string | undefined;
          const ringSame = states.focus.ring === rest.ring && states.focus.bgOwn === rest.bgOwn;
          if (fv && ringSame) {
            const bb = (await h.boundingBox())!;
            fShot = `${OUT}/${lang}-${pg.name}-${i}-focus.png`;
            await page.screenshot({ path: fShot, clip: { x: Math.max(0, bb.x - 24), y: Math.max(0, bb.y - 24), width: bb.width + 48, height: bb.height + 48 } });
            findings.push({ page: pg.name, lang, label, state: "focus", issue: "no visible focus indicator", shot: fShot });
          }
          if (rest.hasText && rest.ratio < 4.5 && !rest.gradient) findings.push({ page: pg.name, lang, label, state: "rest", ...pick(rest), issue: "low contrast" });
          for (const st of ["hover", "active", "focus"]) {
            const m = states[st];
            if (!rest.hasText || m.gradient) continue;
            if (m.ratio < 4.5 && m.ratio < rest.ratio - 0.3)
              findings.push({ page: pg.name, lang, label, state: st, ...pick(m), restRatio: rest.ratio, issue: m.ratio < 2 ? "UNREADABLE" : "contrast drops below 4.5", shot: st === "hover" ? hShot : st === "active" ? aShot : undefined } as Finding);
          }
          // selected + hover: turn an unpressed toggle / unselected tab on, hover it, measure, then restore
          const kind = await h.evaluate((e) => e.getAttribute("aria-pressed") === "false" ? "toggle" : e.getAttribute("role") === "tab" && e.getAttribute("aria-selected") === "false" ? "tab" : "");
          if (kind && rest.hasText !== undefined) {
            await page.evaluate(() => (document.activeElement as HTMLElement)?.blur?.());
            await h.click();
            const bb = (await h.boundingBox())!;
            await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
            await settle(page);
            const sel = await h.evaluate(new Function("return " + MEASURE)() as (e: Element) => any);
            const selRest = await (async () => { await page.mouse.move(1, 1); await settle(page); return h.evaluate(new Function("return " + MEASURE)() as (e: Element) => any); })();
            if (sel.hasText && !sel.gradient && sel.ratio < 4.5 && sel.ratio < selRest.ratio - 0.3) {
              await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
              await settle(page);
              const f = `${OUT}/${lang}-${pg.name}-${i}-selhover.png`;
              await page.screenshot({ path: f, clip: { x: Math.max(0, bb.x - 24), y: Math.max(0, bb.y - 24), width: bb.width + 48, height: bb.height + 48 } });
              findings.push({ page: pg.name, lang, label, state: "selected+hover", ...pick(sel), restRatio: selRest.ratio, issue: sel.ratio < 2 ? "UNREADABLE" : "contrast drops below 4.5", shot: f } as Finding);
            }
            if (kind === "toggle") await h.click();
            await page.mouse.move(1, 1);
          }
          // move hover off & clean up dialogs/menus that a focus may have opened
          await page.keyboard.press("Escape").catch(() => {});
          if (!page.url().startsWith(BASE + path.split("?")[0])) { await page.goto(BASE + path, { waitUntil: "networkidle" }); }
        } catch (e) {
          // element detached etc.
        }
      }
      await ctx.close();
      console.log(`${lang} ${pg.name}: ${seen.size} controls`);
    }
  }
  writeFileSync(`${OUT}/findings-${process.env.AUDIT_LANGS ?? "all"}.json`, JSON.stringify(findings, null, 2));
  console.log(`checked ${checked} control instances, ${findings.length} findings`);
  for (const f of findings) console.log(JSON.stringify(f));
  await browser.close();
}
function pick(m: any) { return { ratio: m.ratio, fg: m.fg, bg: m.bg }; }

main();
