import type { WhatsAppCommand } from "./types";

export function parseCommand(raw: string): WhatsAppCommand {
  const text = raw.trim();
  if (!text) return { verb: "UNKNOWN" };

  const upper = text.toUpperCase();
  const tokens = upper.split(/\s+/);
  const verb = tokens[0] as WhatsAppCommand["verb"];

  switch (verb) {
    case "OK":
    case "NO":
    case "WHY":
      return { verb, code: tokens[1]?.replace(/[^A-Z0-9]/g, "") };
    case "EDIT": {
      const code = tokens[1]?.replace(/[^A-Z0-9]/g, "");
      const noteStart = text.indexOf(tokens.slice(0, 2).join(" "));
      const note =
        noteStart >= 0
          ? text.slice(noteStart + tokens.slice(0, 2).join(" ").length).trim()
          : undefined;
      return { verb, code, note };
    }
    case "STATUS":
    case "PAUSE":
    case "RESUME":
    case "HELP":
      return { verb };
    default:
      return { verb: "UNKNOWN" };
  }
}

export function helpText(): string {
  return [
    "Commands:",
    "OK <code> — approve & send",
    "NO <code> — reject draft",
    "EDIT <code> <note> — revise draft",
    "WHY <code> — show reasoning",
    "STATUS — open drafts + pipeline",
    "PAUSE / RESUME — scouts",
    "HELP — this list",
  ].join("\n");
}
