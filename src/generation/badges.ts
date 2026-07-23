import type { RepoSignals } from "../templates/selectTemplate.js";

// Vylepšenie 24.7.2026 (užívateľské rozhodnutie): namiesto toho, aby si model
// vymýšľal badge URL-ky (a tým aj potenciálne nesprávne/neexistujúce), badges
// sa počítajú programaticky, výlučne z overiteľných signálov (Article III -
// žiadne halucinácie). Použité shields.io endpointy sú tie, ktoré si dáta ťahajú
// priamo z GitHub API v čase zobrazenia (license, package.json version) - teda
// nie je to "naše tvrdenie", je to živé zrkadlo reálneho stavu repozitára.
// CI badge je odvodený z reálneho názvu workflow súboru (GitHub-ova vlastná
// URL konvencia), nie z hádania, čo workflow robí.

export interface BadgeInputs {
  owner: string;
  repo: string;
  filePaths: string[];
  packageJson?: RepoSignals["packageJson"];
  hasLicenseFile: boolean;
}

const WORKFLOW_FILE_PATTERN = /^\.github\/workflows\/[^/]+\.ya?ml$/;
const MAX_CI_BADGES = 2;

/**
 * Vráti hotový markdown s badges, alebo undefined ak niet žiadny overiteľný signál
 * (v tom prípade promptBuilder.ts sekciu "badges" úplne vynechá, nenechá model hádať).
 */
export function buildBadgesMarkdown(input: BadgeInputs): string | undefined {
  const badges: string[] = [];

  if (input.hasLicenseFile) {
    badges.push(
      `[![License](https://img.shields.io/github/license/${input.owner}/${input.repo})](https://github.com/${input.owner}/${input.repo}/blob/main/LICENSE)`,
    );
  }

  if (input.packageJson) {
    badges.push(`![Version](https://img.shields.io/github/package-json/v/${input.owner}/${input.repo})`);
  }

  const workflowFiles = input.filePaths.filter((p) => WORKFLOW_FILE_PATTERN.test(p)).slice(0, MAX_CI_BADGES);
  for (const workflowPath of workflowFiles) {
    const filename = workflowPath.split("/").pop();
    if (!filename) continue;
    badges.push(`![CI](https://github.com/${input.owner}/${input.repo}/actions/workflows/${filename}/badge.svg)`);
  }

  return badges.length > 0 ? badges.join(" ") : undefined;
}
