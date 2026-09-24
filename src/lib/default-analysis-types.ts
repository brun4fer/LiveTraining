export const defaultMomentTypes = [
  { code: "ORG_OF", name: "Offensive Organization", color: "#2dd66f", defaultShortcut: "1", sortOrder: 1 },
  { code: "ORG_DEF", name: "Defensive Organization", color: "#38bdf8", defaultShortcut: "2", sortOrder: 2 },
  { code: "TRANS_OF", name: "Offensive Transition", color: "#f59e0b", defaultShortcut: "3", sortOrder: 3 },
  { code: "TRANS_DEF", name: "Defensive Transition", color: "#ef4444", defaultShortcut: "4", sortOrder: 4 },
  { code: "SET_PIECES_OF", name: "Offensive Set Pieces", color: "#ec4899", defaultShortcut: "5", sortOrder: 5 },
  { code: "SET_PIECES_DEF", name: "Defensive Set Pieces", color: "#a78bfa", defaultShortcut: "6", sortOrder: 6 },
] as const;
