#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.resolve(__dirname, "..");
const MONOREPO_ROOT = path.resolve(APP_ROOT, "../..");
const APP_WIDGET_PATH = path.join(APP_ROOT, "public", "chat-widget.js");
const ROOT_WIDGET_PATH = path.join(MONOREPO_ROOT, "public", "chat-widget.js");

if (!fs.existsSync(APP_WIDGET_PATH)) {
  console.error("[cco-widget] missing apps/home/public/chat-widget.js");
  process.exit(1);
}

if (!fs.existsSync(ROOT_WIDGET_PATH)) {
  console.log("[cco-widget] canonical widget source present at apps/home/public/chat-widget.js");
  process.exit(0);
}

const appWidget = fs.readFileSync(APP_WIDGET_PATH, "utf8");
const rootWidget = fs.readFileSync(ROOT_WIDGET_PATH, "utf8");

if (appWidget === rootWidget) {
  console.log("[cco-widget] legacy root widget mirror is aligned with apps/home/public");
  process.exit(0);
}

console.error("[cco-widget] legacy root/public/chat-widget.js drift detected against canonical apps/home/public/chat-widget.js");
process.exit(1);
