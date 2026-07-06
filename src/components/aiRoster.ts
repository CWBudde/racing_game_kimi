// The AI grid — shared by the AIOpponent instances and the RaceDirector so both
// agree on who is racing (ids, colors, grid offsets).
export interface AiRacer {
  id: string;
  label: string;
  color: string;
  carNumber: number;
  startT: number; // grid offset along the racing line (0..1)
}

export const AI_ROSTER: AiRacer[] = [
  { id: "ai-2", label: "#2", color: "#2563eb", carNumber: 2, startT: 0.97 },
  { id: "ai-3", label: "#3", color: "#16a34a", carNumber: 3, startT: 0.94 },
];
