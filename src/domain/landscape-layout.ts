import type { Landscape, WorkArea } from './landscape';

export interface LandscapeNodePosition {
  id: string;
  x: number;
  y: number;
}

/**
 * Place area clusters in a grid, with skill nodes arranged inside each area.
 * Skills with no area are placed in an "Unclassified" row at the bottom.
 */
export function layoutLandscape(landscape: Landscape): {
  skillPositions: Map<string, { x: number; y: number }>;
  areaPositions: Map<string, { x: number; y: number; w: number; h: number }>;
} {
  const skillPositions = new Map<string, { x: number; y: number }>();
  const areaPositions = new Map<string, { x: number; y: number; w: number; h: number }>();

  const NODE_W = 200;
  const NODE_H = 76;
  const GAP_X = 28;
  const GAP_Y = 20;
  const PADDING = 36;

  const areas = landscape.areas;
  const cols = Math.ceil(Math.sqrt(areas.length));

  areas.forEach((area, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);

    const members = area.members;
    const membersPerRow = Math.min(3, Math.max(1, members.length));
    const rowsNeeded = Math.ceil(members.length / membersPerRow);

    const areaW = Math.max(membersPerRow * (NODE_W + GAP_X) - GAP_X + PADDING * 2, 280);
    const areaH = rowsNeeded * (NODE_H + GAP_Y) - GAP_Y + PADDING * 2 + 30;

    const areaX = col * (areaW + 80);
    const areaY = row * (areaH + 80);

    areaPositions.set(area.id, { x: areaX, y: areaY, w: areaW, h: areaH });

    members.forEach((m, i) => {
      const mCol = i % membersPerRow;
      const mRow = Math.floor(i / membersPerRow);
      skillPositions.set(m.skillId, {
        x: areaX + PADDING + mCol * (NODE_W + GAP_X),
        y: areaY + PADDING + 24 + mRow * (NODE_H + GAP_Y),
      });
    });
  });

  // Unclassified skills in a row at the bottom
  if (landscape.unclassified.length > 0) {
    const unclassifiedY = Math.ceil(areas.length / cols) * 400;
    landscape.unclassified.forEach((id, i) => {
      skillPositions.set(id, {
        x: i * (NODE_W + GAP_X) + PADDING,
        y: unclassifiedY,
      });
    });
  }

  return { skillPositions, areaPositions };
}

/** Generate stable colors for areas based on their index. */
export function areaColors(areas: WorkArea[]): Map<string, string> {
  const palette = [
    'var(--rel-handoff)',
    'var(--rel-depends)',
    'var(--rel-policy)',
    'var(--ok)',
    'var(--info)',
    'var(--warn)',
    'var(--rel-conflict)',
    'var(--primary)',
  ];
  const colors = new Map<string, string>();
  areas.forEach((a, i) => colors.set(a.id, palette[i % palette.length]));
  return colors;
}
