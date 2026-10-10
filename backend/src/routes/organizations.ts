import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { audit, createOrganization, listUserOrgs } from "../lib/db";

const router = Router();

/** GET /api/organizations — list user's workspaces */
router.get("/", requireAuth, (req, res) => {
  const user = req.user!;
  res.json(listUserOrgs(user.email));
});

/** POST /api/organizations — create a new workspace */
router.post("/", requireAuth, (req, res) => {
  const user = req.user!;
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "Workspace name is required" });
    return;
  }
  if (name.length > 60) {
    res.status(400).json({ error: "Workspace name must be 60 characters or fewer" });
    return;
  }

  const org = createOrganization(name, user.email);
  audit(org.id, user.email, "workspace.created", name.slice(0, 60));
  res.status(201).json({ id: org.id, name: org.name, role: "admin" as const });
});

export default router;
