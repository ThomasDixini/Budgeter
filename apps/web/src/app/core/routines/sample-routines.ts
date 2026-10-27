import { Category } from './category';
import { Goal } from './goal';
import { Routine } from './routine';
import { Task } from './task';

/*
 * Placeholder content taken from the "Rotinas & Metas" boards of the Design canvas (artifact 8b717000).
 * Tasks seed the in-memory store until they can be persisted. Categories, goals and routines
 * now come from the API; their samples only feed the fake gateways used by tests.
 */

export const SAMPLE_CATEGORIES: readonly Category[] = [
  { id: 'study', name: 'Study', color: '#7DD3FC' },
  { id: 'networking', name: 'Networking', color: '#F0ABFC' },
  { id: 'reading', name: 'Reading', color: '#FBBF24' },
  { id: 'exercise', name: 'Exercise', color: '#FCA5A5' },
];

export const SAMPLE_ROUTINES: readonly Routine[] = [
  {
    id: 'weekdays',
    name: 'Weekdays',
    days: [0, 1, 2, 3, 4],
    start: '08:00',
    end: '17:00',
    blocks: [
      { id: 'work', name: 'Work', start: '08:00', end: '12:00' },
      { id: 'lunch', name: 'Lunch', start: '12:00', end: '13:30' },
      { id: 'csharp', name: 'C# study', start: '13:30', end: '15:00', categoryId: 'study' },
      { id: 'network', name: 'Networking', start: '15:00', end: '17:00', categoryId: 'networking' },
    ],
  },
  {
    id: 'weekend',
    name: 'Weekend',
    days: [5, 6],
    start: '09:00',
    end: '14:00',
    blocks: [
      { id: 'workout', name: 'Workout', start: '09:00', end: '10:00', categoryId: 'exercise' },
      { id: 'read', name: 'Reading', start: '10:00', end: '12:00', categoryId: 'reading' },
      { id: 'weekend-lunch', name: 'Lunch', start: '12:00', end: '13:30' },
    ],
  },
];

export const SAMPLE_TASKS: readonly Task[] = [
  { id: 't1', title: 'Reply to pending emails', done: true },
  { id: 't2', title: 'Review class 3 notes', done: true, categoryId: 'study' },
  { id: 't3', title: 'Do the LINQ exercises', done: false, categoryId: 'study' },
  { id: 't4', title: 'Message 2 contacts', done: false, categoryId: 'networking' },
  { id: 't5', title: 'Read 20 pages', done: false, categoryId: 'reading' },
];

export const SAMPLE_GOALS: readonly Goal[] = [
  {
    id: 'g1',
    categoryId: 'study',
    title: 'Study C# 5x a week',
    type: 'frequency',
    period: 'weekly',
    done: 3,
    target: 5,
  },
  {
    id: 'g2',
    categoryId: 'study',
    title: 'Finish the C# course',
    type: 'objective',
    period: 'custom',
    done: 4,
    target: 12,
    unit: 'modules',
    deadline: '2026-12-15',
  },
  {
    id: 'g3',
    categoryId: 'study',
    title: 'Review notes every day',
    type: 'frequency',
    period: 'daily',
    done: 1,
    target: 1,
  },
  {
    id: 'g4',
    categoryId: 'networking',
    title: '10 new contacts this month',
    type: 'frequency',
    period: 'monthly',
    done: 6,
    target: 10,
  },
  {
    id: 'g5',
    categoryId: 'networking',
    title: 'Attend 1 event',
    type: 'frequency',
    period: 'monthly',
    done: 0,
    target: 1,
  },
  {
    id: 'g6',
    categoryId: 'reading',
    title: 'Read 12 books in 2026',
    type: 'objective',
    period: 'yearly',
    done: 9,
    target: 12,
    unit: 'books',
  },
  {
    id: 'g7',
    categoryId: 'exercise',
    title: 'Work out 3x a week',
    type: 'frequency',
    period: 'weekly',
    done: 1,
    target: 3,
  },
];
