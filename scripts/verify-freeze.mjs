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
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  domContracts.ids = [...new Set(domContracts.ids)].sort();
  domContracts.names = [...new Set(domContracts.names)].sort();
  domContracts.dataTestIds = [...new Set(domContracts.dataTestIds)].sort();
  domContracts.roles = [...new Set(domContracts.roles)].sort();
  domContracts.placeholders = [...new Set(domContracts.placeholders)].sort();
  domContracts.htmlFors = [...new Set(domContracts.htmlFors)].sort();

  return { texts: texts.sort(), domContracts };
}

const freezeDir = path.resolve("design-review/freeze");
let violations = 0;

for (const screen of SCREENS) {
  const freezeFile = path.join(freezeDir, `${screen.id}.json`);
  if (!fs.existsSync(freezeFile)) {
    console.error(`[verify] Missing freeze snapshot for ${screen.id}`);
    violations++;
    continue;
  }
  const frozen = JSON.parse(fs.readFileSync(freezeFile, "utf-8"));
  const current = extractContracts(path.resolve(screen.file));

  // Check missing texts
  for (const t of frozen.texts) {
    if (!current.texts.includes(t)) {
      console.error(`[VIOLATION] Screen ${screen.id}: Text missing: "${t}"`);
      violations++;
    }
  }

  // Check missing IDs
  for (const id of frozen.domContracts.ids) {
    if (!current.domContracts.ids.includes(id)) {
      console.error(`[VIOLATION] Screen ${screen.id}: DOM id missing: "${id}"`);
      violations++;
    }
  }

  // Check missing names
  for (const name of frozen.domContracts.names) {
    if (!current.domContracts.names.includes(name)) {
      console.error(`[VIOLATION] Screen ${screen.id}: Input name missing: "${name}"`);
      violations++;
    }
  }

  // Check missing dataTestIds
  for (const dt of frozen.domContracts.dataTestIds) {
    if (!current.domContracts.dataTestIds.includes(dt)) {
      console.error(`[VIOLATION] Screen ${screen.id}: data-testid missing: "${dt}"`);
      violations++;
    }
  }
}

if (violations === 0) {
  console.log("✓ Freeze check PASSED: 0 content/DOM violations detected.");
  process.exit(0);
} else {
  console.error(`✗ Freeze check FAILED: ${violations} violation(s) detected.`);
  process.exit(1);
}
