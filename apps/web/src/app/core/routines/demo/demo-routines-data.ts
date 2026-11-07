import { parseIsoDate } from '../../calendar/date-label';
import { toMinutes, weekdayIndex } from '../../calendar/time-of-day';
import { addDays } from '../../finances/demo/demo-dates';
import { Category } from '../category';
import { BlockOutcome } from '../day-plan';
import { Goal } from '../goal';
import { Routine, RoutineBlock } from '../routine';
import { Task } from '../task';

type Language = 'en-US' | 'pt-BR';

/** Names shown by the demo, as [English, Portuguese]. */
const WORDS: Readonly<Record<string, readonly [string, string]>> = {
  study: ['Study', 'Estudo'],
  networking: ['Networking', 'Networking'],
  reading: ['Reading', 'Leitura'],
  exercise: ['Exercise', 'Exercício'],
  projects: ['Side projects', 'Projetos pessoais'],
  wellbeing: ['Wellbeing', 'Bem-estar'],
  weekdays: ['Weekdays', 'Dias úteis'],
  weekend: ['Weekend', 'Fim de semana'],
  morningWorkout: ['Morning workout', 'Treino da manhã'],
  work: ['Work', 'Trabalho'],
  lunch: ['Lunch', 'Almoço'],
  csharp: ['C# study', 'Estudo de C#'],
  project: ['Side project', 'Projeto pessoal'],
  network: ['Networking', 'Networking'],
  evening: ['Evening reading', 'Leitura da noite'],
  workout: ['Workout', 'Treino'],
  reading2: ['Reading', 'Leitura'],
  meditation: ['Meditation', 'Meditação'],
  emails: ['Reply to pending emails', 'Responder e-mails pendentes'],
  notes: ['Review class notes', 'Revisar as anotações de aula'],
  linq: ['Do the LINQ exercises', 'Fazer os exercícios de LINQ'],
  contacts: ['Message 2 contacts', 'Mandar mensagem para 2 contatos'],
  pages: ['Read 20 pages', 'Ler 20 páginas'],
  water: ['Drink 2 liters of water', 'Beber 2 litros de água'],
  plan: ['Plan the week', 'Planejar a semana'],
  passport: ['Renew the passport', 'Renovar o passaporte'],
  gym: ['Pay the gym', 'Pagar a academia'],
  backup: ['Back up the photos', 'Fazer backup das fotos'],
  goalCsharp: ['Study C# 5x a week', 'Estudar C# 5x por semana'],
  goalCourse: ['Finish the C# course', 'Concluir o curso de C#'],
  goalNotes: ['Review notes every day', 'Revisar as anotações todo dia'],
  goalNetwork: ['Network 3x a week', 'Fazer networking 3x por semana'],
  goalMeetup: ['Attend a tech meetup', 'Ir a um encontro de tecnologia'],
  goalBooks: ['Read 12 books this year', 'Ler 12 livros neste ano'],
  goalReading: ['Read 15 times a month', 'Ler 15 vezes por mês'],
  goalWorkout: ['Work out 3x a week', 'Treinar 3x por semana'],
  goalProject: ['Work on the side project 4x a week', 'Trabalhar no projeto 4x por semana'],
  goalPublish: ['Publish the side project', 'Publicar o projeto pessoal'],
  goalMeditate: ['Meditate 2x a week', 'Meditar 2x por semana'],
  modules: ['modules', 'módulos'],
  events: ['events', 'eventos'],
  books: ['books', 'livros'],
  releases: ['releases', 'lançamentos'],
};

/** Days of past routine history the demo comes with. */
const HISTORY_DAYS = 90;
const DONE_CHANCE = 0.78;
const SKIPPED_CHANCE = 0.1;
const TASK_DONE_CHANCE = 0.8;
const TASK_DONE_TODAY_CHANCE = 0.5;

/** Everything the demo Routines & Goals screens start from. */
export interface DemoRoutinesData {
  readonly categories: readonly Category[];
  readonly routines: readonly Routine[];
  readonly tasks: readonly Task[];
  readonly goals: readonly Goal[];
  /** Blocks completed or skipped, by ISO day. */
  readonly outcomes: ReadonlyMap<string, readonly BlockOutcome[]>;
  /** Ids of the tasks done, by ISO day. */
  readonly completedTasks: ReadonlyMap<string, readonly string[]>;
}

/**
 * A repeatable number from 0 up to (not including) 1 for a key, so the same day always gives the
 * same history without a random source.
 * @example chanceOf('2026-11-05|work') // 0.4181…
 */
export function chanceOf(key: string): number {
  let hash = 2166136261;
  for (const character of key) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  return hash / 4294967296;
}

/**
 * The made-up routines, tasks, goals and past days the demo shows. The same day (and language) always
 * gives the same data; blocks that have not ended yet today have no outcome.
 * @example buildDemoRoutines('2026-11-07', 'en-US', 9 * 60).routines.length // 2
 */
export function buildDemoRoutines(
  today: string,
  language: Language,
  nowMinutes: number,
): DemoRoutinesData {
  const word = (key: string): string => WORDS[key][language === 'pt-BR' ? 1 : 0];
  const routines = buildRoutines(word);
  const tasks = buildTasks(today, word);
  return {
    categories: buildCategories(word),
    routines,
    tasks,
    goals: buildGoals(today, word),
    outcomes: buildOutcomes(today, nowMinutes, routines),
    completedTasks: buildCompletedTasks(today, tasks),
  };
}

function buildCategories(word: (key: string) => string): Category[] {
  return [
    { id: 'study', name: word('study'), color: '#7DD3FC' },
    { id: 'networking', name: word('networking'), color: '#F0ABFC' },
    { id: 'reading', name: word('reading'), color: '#FBBF24' },
    { id: 'exercise', name: word('exercise'), color: '#FCA5A5' },
    { id: 'projects', name: word('projects'), color: '#86EFAC' },
    { id: 'wellbeing', name: word('wellbeing'), color: '#C4B5FD' },
  ];
}

function block(
  id: string,
  name: string,
  start: string,
  end: string,
  categoryId?: string,
): RoutineBlock {
  return categoryId === undefined ? { id, name, start, end } : { id, name, start, end, categoryId };
}

function buildRoutines(word: (key: string) => string): Routine[] {
  return [
    {
      id: 'weekdays',
      name: word('weekdays'),
      days: [0, 1, 2, 3, 4],
      start: '07:00',
      end: '21:00',
      blocks: [
        block('workout', word('morningWorkout'), '07:00', '08:00', 'exercise'),
        block('work', word('work'), '08:30', '12:00'),
        block('lunch', word('lunch'), '12:00', '13:00'),
        block('csharp', word('csharp'), '13:00', '15:00', 'study'),
        block('project', word('project'), '15:00', '16:30', 'projects'),
        block('network', word('network'), '16:30', '17:30', 'networking'),
        block('reading', word('evening'), '20:00', '21:00', 'reading'),
      ],
    },
    {
      id: 'weekend',
      name: word('weekend'),
      days: [5, 6],
      start: '09:00',
      end: '18:00',
      blocks: [
        block('weekend-workout', word('workout'), '09:00', '10:00', 'exercise'),
        block('weekend-reading', word('reading2'), '10:00', '12:00', 'reading'),
        block('weekend-lunch', word('lunch'), '12:00', '13:30'),
        block('weekend-project', word('project'), '14:00', '16:00', 'projects'),
        block('weekend-csharp', word('csharp'), '16:00', '17:00', 'study'),
        block('weekend-meditation', word('meditation'), '17:00', '17:30', 'wellbeing'),
      ],
    },
  ];
}

function buildTasks(today: string, word: (key: string) => string): Task[] {
  return [
    { id: 'emails', title: word('emails'), repeat: 'daily', days: [] },
    {
      id: 'notes',
      title: word('notes'),
      categoryId: 'study',
      repeat: 'weekly',
      days: [0, 1, 2, 3, 4],
    },
    { id: 'linq', title: word('linq'), categoryId: 'study', repeat: 'weekly', days: [1, 3] },
    {
      id: 'contacts',
      title: word('contacts'),
      categoryId: 'networking',
      repeat: 'weekly',
      days: [0, 2, 4],
    },
    { id: 'pages', title: word('pages'), categoryId: 'reading', repeat: 'daily', days: [] },
    { id: 'water', title: word('water'), categoryId: 'wellbeing', repeat: 'daily', days: [] },
    { id: 'plan', title: word('plan'), repeat: 'weekly', days: [6] },
    { id: 'passport', title: word('passport'), repeat: 'once', days: [], date: addDays(today, 3) },
    { id: 'gym', title: word('gym'), repeat: 'once', days: [], date: addDays(today, -4) },
    { id: 'backup', title: word('backup'), repeat: 'once', days: [], date: addDays(today, 10) },
  ];
}

function frequency(
  id: string,
  categoryId: string,
  title: string,
  period: Goal['period'],
  target: number,
): Goal {
  return { id, categoryId, title, type: 'frequency', period, done: 0, target };
}

function objective(
  id: string,
  categoryId: string,
  title: string,
  target: number,
  unit: string,
  rest: Pick<Goal, 'period' | 'deadline' | 'achievedOn'>,
): Goal {
  return { id, categoryId, title, type: 'objective', done: 0, target, unit, ...rest };
}

function buildGoals(today: string, word: (key: string) => string): Goal[] {
  return [
    frequency('goal-csharp', 'study', word('goalCsharp'), 'weekly', 5),
    objective('goal-course', 'study', word('goalCourse'), 12, word('modules'), {
      period: 'custom',
      deadline: addDays(today, 45),
    }),
    frequency('goal-notes', 'study', word('goalNotes'), 'daily', 1),
    frequency('goal-network', 'networking', word('goalNetwork'), 'weekly', 3),
    objective('goal-meetup', 'networking', word('goalMeetup'), 1, word('events'), {
      period: 'custom',
      deadline: addDays(today, 20),
    }),
    objective('goal-books', 'reading', word('goalBooks'), 12, word('books'), {
      period: 'yearly',
      achievedOn: addDays(today, -12),
    }),
    frequency('goal-reading', 'reading', word('goalReading'), 'monthly', 15),
    frequency('goal-workout', 'exercise', word('goalWorkout'), 'weekly', 3),
    frequency('goal-project', 'projects', word('goalProject'), 'weekly', 4),
    objective('goal-publish', 'projects', word('goalPublish'), 1, word('releases'), {
      period: 'custom',
      deadline: addDays(today, 60),
    }),
    frequency('goal-meditate', 'wellbeing', word('goalMeditate'), 'weekly', 2),
  ];
}

function routineOn(routines: readonly Routine[], day: string): Routine | undefined {
  const weekday = weekdayIndex(parseIsoDate(day));
  return routines.find((routine) => routine.days.includes(weekday));
}

function outcomeFor(
  day: string,
  routine: Routine,
  planned: RoutineBlock,
): BlockOutcome | undefined {
  const chance = chanceOf(`${day}|${planned.id}`);
  if (chance >= DONE_CHANCE + SKIPPED_CHANCE) return undefined;
  const outcome = chance < DONE_CHANCE ? 'done' : 'skipped';
  return { routineId: routine.id, blockId: planned.id, outcome, at: planned.end };
}

function outcomesOfDay(
  day: string,
  routine: Routine,
  nowMinutes: number | undefined,
): BlockOutcome[] {
  return routine.blocks
    .filter((planned) => nowMinutes === undefined || toMinutes(planned.end) <= nowMinutes)
    .map((planned) => outcomeFor(day, routine, planned))
    .filter((outcome): outcome is BlockOutcome => outcome !== undefined);
}

function buildOutcomes(
  today: string,
  nowMinutes: number,
  routines: readonly Routine[],
): Map<string, BlockOutcome[]> {
  const outcomes = new Map<string, BlockOutcome[]>();
  for (let back = 0; back <= HISTORY_DAYS; back++) {
    const day = addDays(today, -back);
    const routine = routineOn(routines, day);
    if (routine === undefined) continue;
    outcomes.set(day, outcomesOfDay(day, routine, back === 0 ? nowMinutes : undefined));
  }
  return outcomes;
}

function occursOnDay(task: Task, day: string): boolean {
  if (task.repeat === 'daily') return true;
  if (task.repeat === 'once') return task.date === day;
  return task.days.includes(weekdayIndex(parseIsoDate(day)));
}

function buildCompletedTasks(today: string, tasks: readonly Task[]): Map<string, string[]> {
  const completed = new Map<string, string[]>();
  for (let back = 0; back <= HISTORY_DAYS; back++) {
    const day = addDays(today, -back);
    const chance = back === 0 ? TASK_DONE_TODAY_CHANCE : TASK_DONE_CHANCE;
    const done = tasks
      .filter((task) => occursOnDay(task, day) && chanceOf(`${day}|task|${task.id}`) < chance)
      .map((task) => task.id);
    completed.set(day, done);
  }
  return completed;
}
