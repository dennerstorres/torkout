export interface CompletionExercise {
  sets: Array<{ completed: boolean }>;
  status: 'completed' | 'planned' | 'skipped' | 'stopped';
}

export function calculateWorkoutCompletion(
  exercises: CompletionExercise[],
): 'completed' | 'partial' {
  return exercises.every(
    (exercise) => exercise.status === 'completed' && exercise.sets.every((set) => set.completed),
  )
    ? 'completed'
    : 'partial';
}
