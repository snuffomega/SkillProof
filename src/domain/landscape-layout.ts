import type { Landscape, WorkArea } from './landscape';

/**
 * Place area clusters in a grid, with skill nodes arranged inside each area.
 * Skills with no area are placed in an "Unclassified" row at the bottom.
 *
 * A skill that belongs to multiple areas is placed in its strongest area only
 * (to avoid duplicate nodes), but the area boxes are sized and positioned to
 * account for all their declared members — even ones physically elsewhere —
 * so boxes never overlap or clip.
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
  const AREA_GAP = 80;

  const areas = landscape.areas;
  const cols = Math.ceil(Math.sqrt(areas.length));

  // Determine which area each skill is physically placed in (its strongest).
  const primaryAreaForSkill = new Map<string, string>();
  for (const skill of landscape.memberships.keys()) {
    const mbs = landscape.memberships.get(skill) ?? [];
    if (mbs.length > 0) {
      primaryAreaForSkill.set(skill, mbs[0].areaId);
    }
  }

  // Compute max row height per grid row so areas in the same row don't overlap.
  const rowMaxHeight = new Map<number, number>();
  const rowMaxWidth = new Map<number, number>();

  areas.forEach((area, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);

    // Count only members physically placed in this area
    const placedMembers = area.members.filter((m) => primaryAreaForSkill.get(m.skillId) === area.id);
    const count = Math.max(1, placedMembers.length);
    const membersPerRow = Math.min(3, count);
    const rowsNeeded = Math.ceil(count / membersPerRow);

    const areaW = Math.max(membersPerRow * (NODE_W + GAP_X) - GAP_X + PADDING * 2, 280);
    const areaH = rowsNeeded * (NODE_H + GAP_Y) - GAP_Y + PADDING * 2 + 30;

    rowMaxHeight.set(row, Math.max(rowMaxHeight.get(row) ?? 0, areaH));
    rowMaxWidth.set(col, Math.max(rowMaxWidth.get(col) ?? 0, areaW));
  });

  // Compute column X offsets (packed, no gaps between columns within a row)
  const colX = new Map<number, number>();
  let cumulativeX = 0;
  for (let c = 0; c < cols; c++) {
    colX.set(c, cumulativeX);
    cumulativeX += (rowMaxWidth.get(c) ?? 0) + AREA_GAP;
  }

  // Compute row Y offsets
  const rowY = new Map<number, number>();
  let cumulativeY = 0;
  const totalRows = Math.ceil(areas.length / cols);
  for (let r = 0; r < totalRows; r++) {
    rowY.set(r, cumulativeY);
    cumulativeY += (rowMaxHeight.get(r) ?? 0) + AREA_GAP;
  }

  areas.forEach((area, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);

    const placedMembers = area.members.filter((m) => primaryAreaForSkill.get(m.skillId) === area.id);
    const count = Math.max(1, placedMembers.length);
    const membersPerRow = Math.min(3, count);
    const rowsNeeded = Math.ceil(count / membersPerRow);

    const areaW = Math.max(membersPerRow * (NODE_W + GAP_X) - GAP_X + PADDING * 2, 280);
    const areaH = rowsNeeded * (NODE_H + GAP_Y) - GAP_Y + PADDING * 2 + 30;

    const areaX = colX.get(col) ?? 0;
    const areaY = rowY.get(row) ?? 0;

    areaPositions.set(area.id, { x: areaX, y: areaY, w: areaW, h: areaH });

    placedMembers.forEach((m, i) => {
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
    const unclassifiedY = cumulativeY;
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
