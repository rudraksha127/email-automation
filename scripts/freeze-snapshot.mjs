import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const SCREENS = [
  { id: "login", file: "frontend/src/app/login/page.tsx" },
  { id: "dashboard", file: "frontend/src/app/dashboard/page.tsx" },
  { id: "mails", file: "frontend/src/app/mails/page.tsx" },
  { id: "mail-detail", file: "frontend/src/app/mails/[id]/page.tsx" },
  { id: "batches", file: "frontend/src/app/batches/page.tsx" },
  { id: "batch-detail", file: "frontend/src/app/batches/[id]/page.tsx" },
  { id: "history", file: "frontend/src/app/history/page.tsx" },
  { id: "settings", file: "frontend/src/app/settings/page.tsx" },
  { id: "profile", file: "frontend/src/app/profile/page.tsx" },
  { id: "workspace", file: "frontend/src/app/workspace/page.tsx" },
  { id: "privacy-policy", file: "frontend/src/app/privacy-policy/page.tsx" },
  { id: "terms", file: "frontend/src/app/terms/page.tsx" },
  { id: "developer-modal", file: "frontend/src/components/DeveloperModal.tsx" },
  { id: "app-shell", file: "frontend/src/components/AppShell.tsx" },
];

function extractContracts(filePath) {
  const code = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const texts = [];
  const domContracts = {
    ids: [],
    names: [],
    dataTestIds: [],
    ariaAttributes: [],
    roles: [],
    placeholders: [],
    htmlFors: [],
    buttonTexts: [],
    headings: [],
  };

  function visit(node) {
    if (ts.isJsxText(node)) {
      const text = node.text.trim().replace(/\s+/g, " ");
      if (text && !texts.includes(text)) texts.push(text);
    } else if (ts.isJsxAttribute(node)) {
      const attrName = node.name.text;
      const initializer = node.initializer;
      let attrVal = "";
      if (initializer && ts.isStringLiteral(initializer)) {
        attrVal = initializer.text;
      }

      if (attrName === "id" && attrVal) domContracts.ids.push(attrVal);
      if (attrName === "name" && attrVal) domContracts.names.push(attrVal);
      if (attrName === "data-testid" && attrVal) domContracts.dataTestIds.push(attrVal);
      if (attrName === "role" && attrVal) domContracts.roles.push(attrVal);
      if (attrName.startsWith("aria-") && attrVal) {
        domContracts.ariaAttributes.push({ attr: attrName, value: attrVal });
      }
      if (attrName === "placeholder" && attrVal) domContracts.placeholders.push(attrVal);
      if (attrName === "htmlFor" && attrVal) domContracts.htmlFors.push(attrVal);
    } else if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = (ts.isJsxElement(node) ? node.openingElement : node).tagName.getText(sourceFile);
      if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName)) {
        const text = node.getText(sourceFile).replace(/<[^>]+>/g, " ").trim().replace(/\s+/g, " ");
        if (text) domContracts.headings.push({ tag: tagName, text });
      }
      if (tagName === "button" || tagName === "Button") {
        const text = node.getText(sourceFile).replace(/<[^>]+>/g, " ").trim().replace(/\s+/g, " ");
        if (text && !domContracts.buttonTexts.includes(text)) domContracts.buttonTexts.push(text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Deduplicate
  domContracts.ids = [...new Set(domContracts.ids)].sort();
  domContracts.names = [...new Set(domContracts.names)].sort();
  domContracts.dataTestIds = [...new Set(domContracts.dataTestIds)].sort();
  domContracts.roles = [...new Set(domContracts.roles)].sort();
  domContracts.placeholders = [...new Set(domContracts.placeholders)].sort();
  domContracts.htmlFors = [...new Set(domContracts.htmlFors)].sort();

  return {
    filePath,
    extractedAt: new Date().toISOString(),
    texts: texts.sort(),
    domContracts,
  };
}

const outDir = path.resolve("design-review/freeze");
fs.mkdirSync(outDir, { recursive: true });

for (const screen of SCREENS) {
  const fullPath = path.resolve(screen.file);
  if (fs.existsSync(fullPath)) {
    const data = extractContracts(fullPath);
    const outFile = path.join(outDir, `${screen.id}.json`);
    fs.writeFileSync(outFile, JSON.stringify(data, null, 2), "utf-8");
    console.log(`[freeze] Created snapshot for ${screen.id} -> ${outFile}`);
  } else {
    console.warn(`[freeze] File not found: ${fullPath}`);
  }
}
