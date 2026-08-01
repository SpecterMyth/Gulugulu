import type { Language } from "../../i18n/core";

export const ONBOARDING_STEP_IDS = [
  "A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10", "A11",
  "A12", "A13", "A14", "A15", "A16", "A17", "A18", "A19", "B01", "B02", "B03", "B04", "B05", "B06",
  "B07", "C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08", "C09", "C10",
  "C11", "C12", "D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "E01",
  "E02", "E03", "F01", "F02", "F03a", "F04", "G01", "G02", "G03", "G04", "G05",
  "G06", "G07",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

export type OnboardingLocalizedCopy = {
  chapter: string;
  label: string;
  cta?: string;
};

/**
 * English text for every persisted onboarding cursor.
 *
 * The factory owns the live, context-sensitive wording for C02-C10, but those
 * cursors stay here too so copy coverage can be verified against the complete
 * 60-step save protocol.
 */
export const ONBOARDING_EN_COPY: Record<OnboardingStepId, OnboardingLocalizedCopy> = {
  A01: { chapter: "Hatched and Hired", label: "Click the glowing egg and approve your first coworker's escape from the shell." },
  A02: { chapter: "Hatched and Hired", label: "Give them one click. Yes, the first day already comes with work." },
  A03: { chapter: "Hatched and Hired", label: "Keep going until 20 clicks. Each job earns XP and coins. Personally click them through probation." },
  A04: { chapter: "Hatched and Hired", label: "You earned coins and XP, and spent stamina. The full workplace starter pack.", cta: "Got it" },
  A05: { chapter: "Hatched and Hired", label: "Click your coworker again to open the menu. No right-click menu here, only attitude." },
  A06: { chapter: "Hatched and Hired", label: "Choose Backyard. That is where all the real trouble is stored." },
  A07: { chapter: "Backyard License", label: "Press D or the right arrow to walk right." },
  A08: { chapter: "Backyard License", label: "Now press A or the left arrow to walk back. You have beaten most pathfinding bots." },
  A09: { chapter: "Backyard License", label: "Head to the hatchery on the left. Use the keys, or click the ground to walk.", cta: "I am at the hatchery" },
  A10: { chapter: "Backyard License", label: "Click Unlock on the second egg pit. One pit cannot hold this many ambitions." },
  A11: { chapter: "Backyard License", label: "Visit the shop and buy a Fire Egg. Time to make the recipe book smoke." },
  A12: { chapter: "Backyard License", label: "Choose Fire Egg. The price is real; so is the new-hire reimbursement." },
  A13: { chapter: "Backyard License", label: "Return to the hatchery and choose Hatch an Egg on the empty pit. The AI used the manual to level a desk." },
  A14: { chapter: "Backyard License", label: "Follow the arrow and choose Upgrade Backyard Lv2. Make room before the eggs start hitting walls." },
  A15: { chapter: "Backyard License", label: "When the Fire Egg is ready, return and collect it. Your new coworker will stay here; do not replace your companion yet." },
  A16: { chapter: "Meet the New Hire", label: "Keep your current character, walk up to the Fire coworker, then choose Companion. You get to make this transfer yourself." },
  A17: { chapter: "Meet the New Hire", label: "Your Fire companion is active. Choose Back in the lower-left and bring them to the main screen." },
  A18: { chapter: "Probation, Round Two", label: "Click your Fire companion 20 times on the main screen. Every click earns coins and XP; click 20 reaches max level." },
  A19: { chapter: "First Cross-Species Fusion", label: "Your Fire coworker is maxed out. Open the Backyard and find the Normal coworker for your first fusion." },

  B01: { chapter: "First Cross-Species Fusion", label: "With Fire active, walk up to the Normal coworker. When two max-level coworkers meet, the Fusion button appears." },
  B02: { chapter: "First Cross-Species Fusion", label: "Choose Fusion. This combines different species; nobody is copy-pasting themselves." },
  B03: { chapter: "First Cross-Species Fusion", label: "This consumes both coworkers and creates one egg of a new species. Check the result, then confirm the fusion." },
  B04: { chapter: "First Cross-Species Fusion", label: "The fusion egg is headed to the hatchery. When it is ready, collect the result yourself.", cta: "Go collect the fusion egg" },
  B05: { chapter: "First Cross-Species Fusion", label: "After 8 seconds, follow the arrow back and choose Collect. The new hire arrives at max level; AI attendance is suspended." },
  B06: { chapter: "Three-Pet Support", label: "First fusion cleared. Max-level Water, Electric, and Ice coworkers just landed in the yard. HR calls it organic growth.", cta: "Welcome the three volunteers" },
  B07: { chapter: "Back to the Main Screen", label: "Choose Back in the lower-left. The factory deserves a proper entrance." },

  C01: { chapter: "Your First Real Shift", label: "Choose Workplace Stack on the main screen. The next run uses the complete, real rules." },
  C02: { chapter: "Workplace Stack Orientation", label: "Your four coworkers are selected. Start the shift with this real roster." },
  C03: { chapter: "Workplace Stack Orientation", label: "Review the hiring cost, cash after payment, and reserved bill before confirming the hires." },
  C04: { chapter: "Workplace Stack Orientation", label: "Match the hanging coworker's element to a desk, then press Space or click the conveyor to drop." },
  C05: { chapter: "Workplace Stack Orientation", label: "Stack the next coworker carefully. Keep a third coworker of the same species away from the pair." },
  C06: { chapter: "Workplace Stack Orientation", label: "Keep placing coworkers until the shift KPI is full." },
  C07: { chapter: "Workplace Stack Orientation", label: "Review the real payroll sheet, then confirm and pay the bill." },
  C08: { chapter: "Workplace Stack Orientation", label: "Choose the first end-of-shift upgrade, or skip it for a refund if cash is short." },
  C09: { chapter: "Workplace Stack Orientation", label: "Choose an upgrade for the second category." },
  C10: { chapter: "Workplace Stack Orientation", label: "Choose the final upgrade to finish the shop." },
  C11: { chapter: "Workplace Stack Orientation", label: "The rest of the first shift resolves automatically. Watch the stack and the final tally." },
  C12: { chapter: "Workplace Stack Orientation", label: "Your first real shift is complete. The full factory is now yours to run." },

  D01: { chapter: "Species Express", label: "First real shift complete: one max-level coworker from each of the six base species, all capacity-exempt. The AI finally skipped the fine print.", cta: "Check the species KPI" },
  D02: { chapter: "Species Express", label: "One species remains. Open Recipe Radar instead of headbutting the recipe chart.", cta: "Open Recipe Radar" },
  D03: { chapter: "Recipe Radar", label: "Radar found Water + Electric: both parents are max level, and the result is still undiscovered. The AI draws the circle; you approve the transfer.", cta: "Take me to the fusion" },
  D04: { chapter: "Recipe Radar", label: "Follow the arrow to the Water coworker and select them. No three-page handover document required." },
  D05: { chapter: "Recipe Radar", label: "Walk up to Voltmouse, the Electric coworker, then choose Fusion." },
  D06: { chapter: "Recipe Radar", label: "Water and Electric will be consumed to make a new-species egg. Confirm the fusion." },
  D07: { chapter: "Recipe Radar", label: "After 8 seconds, follow the arrow back and collect it. The catalogue reaches 8/8, so the AI can stop discussing species KPIs." },
  D08: { chapter: "Species KPI Complete", label: "All eight are here. Next stop: a formal run, where the score, materials, and accidents are all yours.", cta: "Enter the formal run" },

  E01: { chapter: "Back on the Clock", label: "Choose Workplace Stack. The first run taught the rules; this one is entirely yours." },
  E02: { chapter: "Officially on Shift", label: "Choose Start Formal Run. From here on, nobody picks cards, hires, or placements for you." },
  E03: { chapter: "Officially on Shift", label: "The formal run is open. Play it your way; we will cover AI and Steam after you leave this run.", cta: "Continue" },

  F01: { chapter: "Optional AI Contractors", label: "Visit the Notice Board. It houses two digital contractors: Codex and Claude.", cta: "Open the Notice Board" },
  F02: { chapter: "Optional AI Contractors", label: "Connecting Codex or Claude can draw a new face for fusion results. The full game works without either.", cta: "Next" },
  F03a: { chapter: "Optional AI Contractors", label: "Connect from the Notice Board if you want. Otherwise, let the AI sit this one out.", cta: "Skip AI for now" },
  F04: { chapter: "Optional AI Contractors", label: "Classic recipes always work. AI is an art contractor, not an admission ticket.", cta: "Understood" },

  G01: { chapter: "Steam Trading", label: "Last stop: visit the Trading Market. We are only looking; nobody is selling your children." },
  G02: { chapter: "Steam Trading", label: "This is where inventory sync, market prices, and the Steam Market entry live. Steam confirms any real trade on the web.", cta: "Next" },
  G03: { chapter: "Steam Trading", label: "Choose Open Steam Market. This opens the page once; there are no midnight pop-ups." },
  G04: { chapter: "Steam Trading", label: "Graduation does not depend on the page loading. Even if the browser goes on strike, you now know the entrance.", cta: "Continue" },
  G05: { chapter: "Graduation Check", label: "Hatching, cross-species fusion, Recipe Radar, Workplace Stack, AI, and Steam—you now know more than the product manager.", cta: "Check the next item" },
  G06: { chapter: "Graduation Check", label: "From now on, new systems explain themselves once, one tip at a time. The AI promises not to schedule a group meeting.", cta: "Good. Fewer meetings." },
  G07: { chapter: "Onboarding Complete", label: "Your new-hire protection period is over. Go stack the company—or turn it into an incident report.", cta: "Clock out and play" },
};

export function onboardingLanguageFromStorage(): Language {
  if (typeof window === "undefined") return "en";
  try {
    return window.localStorage.getItem("gulugulu.language") === "zh" ? "zh" : "en";
  } catch {
    return "en";
  }
}
