import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

function block(source, selector) {
  const start = source.indexOf(selector);
  assert.notEqual(start, -1, `Missing CSS selector: ${selector}`);
  const open = source.indexOf("{", start);
  const close = source.indexOf("}", open);
  assert.ok(open > start && close > open, `Malformed CSS block: ${selector}`);
  return source.slice(open + 1, close);
}

test("the primary intention composer keeps typing in the main field across pencil UI layers", async () => {
  const [layout, page, css, runtime, packageJson] = await Promise.all([
    read("../app/layout.tsx"),
    read("../app/page.tsx"),
    read("../app/asympta-product-polish.css"),
    read("../components/asympta-intent-input-polish.tsx"),
    read("../package.json"),
  ]);

  const pencilImport = layout.indexOf('import "./asympta-protocell-pencil.css";');
  const polishImport = layout.indexOf('import "./asympta-product-polish.css";');
  assert.ok(pencilImport >= 0 && polishImport > pencilImport, "product polish must load after the experimental pencil layer");

  assert.match(page, /import \{ AsymptaIntentInputPolish \} from "@\/components\/asympta-intent-input-polish";/);
  const composerMount = page.indexOf("<AsymptaIntentComposer />");
  const polishMount = page.indexOf("<AsymptaIntentInputPolish />");
  assert.ok(composerMount >= 0 && polishMount > composerMount, "input polish must mount after the controlled composer");

  const shell = block(css, ".asympta-intent-shell");
  assert.match(shell, /border:\s*0\s*!important/);
  assert.match(shell, /background:\s*transparent\s*!important/);

  const composer = block(css, ".asympta-intent-composer");
  assert.match(composer, /position:\s*relative\s*!important/);
  assert.match(composer, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+46px\s*!important/);
  assert.match(composer, /width:\s*100%\s*!important/);

  const prompt = block(css, ".asympta-intent-composer::before");
  assert.match(prompt, /position:\s*absolute\s*!important/);
  assert.doesNotMatch(prompt, /grid-column/);

  const textarea = block(css, ".asympta-intent-composer textarea");
  assert.match(textarea, /grid-column:\s*1\s*!important/);
  assert.match(textarea, /width:\s*100%\s*!important/);
  assert.match(textarea, /min-width:\s*0\s*!important/);

  const submit = block(css, ".asympta-intent-composer button");
  assert.match(submit, /grid-column:\s*2\s*!important/);
  assert.match(submit, /min-width:\s*46px\s*!important/);

  assert.match(css, /@media \(max-width:\s*700px\)[\s\S]*?\.asympta-intent-composer textarea\s*\{[\s\S]*?font-size:\s*16px\s*!important/);

  assert.match(runtime, /event\.isComposing\s*\|\|\s*event\.keyCode\s*===\s*229/);
  assert.match(runtime, /setAttribute\("enterkeyhint",\s*"send"\)/);
  assert.match(runtime, /form\.addEventListener\("pointerdown",\s*focusPrimaryInput\)/);
  assert.match(runtime, /textarea\.scrollHeight/);
  assert.match(runtime, /visualViewport\?\.addEventListener\("resize"/);

  assert.match(packageJson, /tests\/intent-input-polish\.test\.mjs/);
});
