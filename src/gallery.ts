import { cases } from "./cases.ts";
import type { CaseManifest, VariantId } from "./types.ts";

const VARIANT_ORDER: VariantId[] = ["broken", "fixed", "control"];
const REPO = "https://github.com/EstebanIndiveri/ui-break-cases";
const PREVIEW_ID = "preview";

function text(tag: string, value: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  node.textContent = value;
  return node;
}

function selectedFromUrl(): { caseId: string; variant: VariantId } {
  const params = new URLSearchParams(window.location.search);
  const caseId = params.get("case") ?? cases[0]?.id ?? "flex-long-text";
  const variantParam = params.get("variant");
  const variant: VariantId = VARIANT_ORDER.includes(variantParam as VariantId)
    ? (variantParam as VariantId)
    : "broken";
  return { caseId, variant };
}

function writeUrl(caseId: string, variant: VariantId): void {
  const params = new URLSearchParams();
  params.set("case", caseId);
  params.set("variant", variant);
  const next = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", next);
}

function fixtureUrl(path: string): string {
  return new URL(path, window.location.href).href;
}

function githubBlob(repoPath: string): string {
  return `${REPO}/blob/main/${repoPath}`;
}

function linkList(
  title: string,
  items: { label: string; href: string }[],
): HTMLElement[] {
  if (items.length === 0) {
    return [];
  }
  const heading = text("h3", title);
  const list = document.createElement("ul");
  list.className = "source-list";
  for (const item of items) {
    const li = document.createElement("li");
    const anchor = document.createElement("a");
    anchor.href = item.href;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.textContent = item.label;
    li.append(anchor);
    list.append(li);
  }
  return [heading, list];
}

export function mountGallery(root: HTMLElement): void {
  let { caseId, variant } = selectedFromUrl();
  if (!cases.some((item) => item.id === caseId)) {
    caseId = cases[0].id;
  }

  const shell = document.createElement("div");
  shell.className = "shell";

  const header = document.createElement("header");
  header.className = "site-header";
  header.append(
    text("h1", "ui-break-cases"),
    text(
      "p",
      "Reproducible UI bugs, explained fixes, and tests you can reuse.",
      "lede",
    ),
  );

  const layout = document.createElement("div");
  layout.className = "layout";

  const nav = document.createElement("nav");
  nav.className = "case-nav";
  nav.setAttribute("aria-label", "Cases");
  nav.append(text("h2", "Cases"));

  const panel = document.createElement("section");
  panel.className = "panel";
  let restoreTabFocus = false;

  const render = (): void => {
    const current = cases.find((item) => item.id === caseId) ?? cases[0];
    caseId = current.id;
    writeUrl(caseId, variant);
    renderNav(nav, caseId, (id) => {
      caseId = id;
      variant = "broken";
      restoreTabFocus = false;
      render();
      nav.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus();
    });
    renderPanel(panel, current, variant, restoreTabFocus, (next) => {
      variant = next;
      restoreTabFocus = true;
      render();
    });
  };

  layout.append(nav, panel);
  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.append(
    text(
      "p",
      "Three cases, nine fixtures. Open each HTML file on its own; gallery chrome is not required.",
    ),
    text("p", "MIT License. Chromium is the verified browser for v0.1."),
  );
  shell.append(header, layout, footer);
  root.replaceChildren(shell);
  render();
}

function renderNav(
  nav: HTMLElement,
  currentId: string,
  onSelect: (id: string) => void,
): void {
  const heading = nav.querySelector("h2") ?? text("h2", "Cases");
  const buttons = cases.map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "case-button";
    button.textContent = item.title;
    button.setAttribute("aria-current", item.id === currentId ? "true" : "false");
    button.addEventListener("click", () => onSelect(item.id));
    return button;
  });
  nav.replaceChildren(heading, ...buttons);
}

function renderPanel(
  panel: HTMLElement,
  current: CaseManifest,
  variant: VariantId,
  restoreTabFocus: boolean,
  onVariant: (id: VariantId) => void,
): void {
  const chosen = current.variants[variant];
  const title = text("h2", current.title, "case-title");
  const failure = text("p", current.failureDescription, "failure");
  const conditionLabel = text("h3", "Reproduction condition");
  const condition = text("p", current.reproductionCondition, "condition");

  const tablist = document.createElement("div");
  tablist.className = "tablist";
  tablist.setAttribute("role", "tablist");
  tablist.setAttribute("aria-label", "Variants");

  for (const id of VARIANT_ORDER) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "tab";
    tab.id = `tab-${id}`;
    tab.dataset.variant = id;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", id === variant ? "true" : "false");
    tab.setAttribute("aria-controls", PREVIEW_ID);
    tab.tabIndex = id === variant ? 0 : -1;
    tab.textContent = current.variants[id].label;
    tab.addEventListener("click", () => onVariant(id));
    tablist.append(tab);
  }

  tablist.addEventListener("keydown", (event) => {
    const index = VARIANT_ORDER.indexOf(variant);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      onVariant(VARIANT_ORDER[(index + 1) % VARIANT_ORDER.length]);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      onVariant(
        VARIANT_ORDER[(index - 1 + VARIANT_ORDER.length) % VARIANT_ORDER.length],
      );
    } else if (event.key === "Home") {
      event.preventDefault();
      onVariant(VARIANT_ORDER[0]);
    } else if (event.key === "End") {
      event.preventDefault();
      onVariant(VARIANT_ORDER[VARIANT_ORDER.length - 1]);
    }
  });

  const tabpanel = document.createElement("div");
  tabpanel.id = PREVIEW_ID;
  tabpanel.className = "preview-scroll";
  tabpanel.setAttribute("role", "tabpanel");
  tabpanel.setAttribute("aria-labelledby", `tab-${variant}`);

  const iframe = document.createElement("iframe");
  iframe.dataset.preview = "true";
  iframe.title = `${current.id} ${variant} variant, ${current.viewport.width}×${current.viewport.height}`;
  iframe.src = fixtureUrl(chosen.path);
  iframe.width = String(current.viewport.width);
  iframe.height = String(current.viewport.height);
  iframe.setAttribute("scrolling", "yes");
  tabpanel.append(iframe);

  const viewportNote = text(
    "p",
    `Preview is locked to ${current.viewport.width}×${current.viewport.height} so the reproduction condition is preserved. The iframe is not resized to the fixture’s content height.`,
    "note",
  );

  const expected = text("h3", "Expected behavior");
  const expectedBody = text("p", chosen.expectedBehavior);
  const why = text("h3", "Why it breaks, and the change");
  const whyBody = text("p", current.explanation);
  const change = document.createElement("pre");
  change.className = "code";
  change.textContent = chosen.relevantChange;

  const links = document.createElement("div");
  links.className = "links";
  const open = document.createElement("a");
  open.href = fixtureUrl(chosen.path);
  open.target = "_blank";
  open.rel = "noreferrer";
  open.textContent = "Open fixture";
  const source = document.createElement("a");
  source.href = githubBlob(`${current.sourceDirectory}/${variant}.html`);
  source.textContent = "Fixture source";
  const testLink = document.createElement("a");
  testLink.href = githubBlob(current.testFile);
  testLink.textContent = "Playwright test";
  links.append(open, source, testLink);

  const limitsTitle = text("h3", "Known limitations");
  const limits = document.createElement("ul");
  limits.className = "limits";
  for (const item of current.knownLimitations) {
    limits.append(text("li", item));
  }

  const provenance = text(
    "p",
    `${current.provenance.kind === "inspired" ? "Inspired" : "Original"}. ${current.provenance.note}`,
    "note",
  );

  panel.replaceChildren(
    title,
    failure,
    conditionLabel,
    condition,
    tablist,
    tabpanel,
    viewportNote,
    expected,
    expectedBody,
    why,
    whyBody,
    change,
    links,
    ...linkList("Sources", current.provenance.sources),
    ...linkList("Further reading", current.links),
    limitsTitle,
    limits,
    provenance,
  );

  const selectedTab = tablist.querySelector<HTMLElement>(
    `[data-variant="${variant}"]`,
  );
  if (restoreTabFocus) {
    selectedTab?.focus();
  }
}
