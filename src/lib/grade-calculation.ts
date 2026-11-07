export type WeightedAssessment = {
  score: number | null
  maxScore: number
  weight: number
}

/** Returns the weighted average on a 0–100 scale, or null when no score counts. */
export function weightedAveragePercent(assessments: WeightedAssessment[]): number | null {
  let weightedTotal = 0
  let totalWeight = 0

  for (const assessment of assessments) {
    const { score, maxScore, weight } = assessment
    if (score == null || !Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) continue
    if (!Number.isFinite(weight) || weight <= 0) continue

    weightedTotal += (score / maxScore) * 100 * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? weightedTotal / totalWeight : null
}
