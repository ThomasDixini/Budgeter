import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PageHeading } from '../../../components/page-heading/page-heading';
import { formatDuration } from '../../../core/calendar/time-of-day';
import {
  CATEGORY_SWATCHES,
  Category,
  countLabel,
  withAlpha,
} from '../../../core/routines/category';
import { averageProgress } from '../../../core/routines/goal';
import { RoutinesStore } from '../../../core/routines/routines-store';

interface CategoryCardView {
  readonly category: Category;
  readonly ring: string;
  readonly goalsLabel: string;
  readonly caption: string;
  readonly progress: number;
}

/** Grid of categories, each opening its goals, plus an inline form to create a new one. */
@Component({
  selector: 'app-routines-categories',
  imports: [RouterLink, PageHeading],
  templateUrl: './categories.html',
  styleUrl: './categories.css',
})
export class Categories {
  private readonly store = inject(RoutinesStore);
  private readonly router = inject(Router);

  protected readonly swatches = CATEGORY_SWATCHES;
  protected readonly isCreating = signal(false);
  protected readonly newName = signal('');
  protected readonly newColor = signal(CATEGORY_SWATCHES[0].color);
  protected readonly cards = computed(() =>
    this.store.categories().map((category) => this.toCard(category)),
  );

  protected startCreating(): void {
    this.isCreating.set(true);
  }

  protected cancelCreating(): void {
    this.isCreating.set(false);
    this.newName.set('');
  }

  protected create(event: SubmitEvent): void {
    event.preventDefault();
    const name = this.newName().trim();
    if (name === '') return;
    const category = this.store.addCategory(name, this.newColor());
    this.cancelCreating();
    void this.router.navigate(['/routines/categories', category.id], {
      queryParams: { newGoal: true },
    });
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  private toCard(category: Category): CategoryCardView {
    const goals = this.store.goals().filter((goal) => goal.categoryId === category.id);
    const blocks = this.store.categoryBlocks(category.id);
    const weekly = formatDuration(this.store.weeklyMinutes(category.id));
    return {
      category,
      ring: withAlpha(category.color, 0.5),
      goalsLabel: countLabel(goals.length, 'goal'),
      caption: `${countLabel(blocks.length, 'block')} · ${weekly} per week`,
      progress: averageProgress(goals),
    };
  }
}
