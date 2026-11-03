import { Component, computed, input, output, signal } from '@angular/core';
import { fieldValue } from '../../../../core/forms/field-value';
import {
  FinanceCategory,
  MAX_CATEGORY_NAME_LENGTH,
  isCategoryNameTaken,
} from '../../../../core/finances/finance-references';

/**
 * Where finance categories are created, renamed and deleted. A category with transactions cannot be
 * deleted: the API refuses it and says so.
 */
@Component({
  selector: 'app-category-manager',
  templateUrl: './category-manager.html',
  styleUrl: './category-manager.css',
})
export class CategoryManager {
  readonly categories = input.required<readonly FinanceCategory[]>();
  readonly add = output<string>();
  readonly rename = output<{ categoryId: string; name: string }>();
  readonly remove = output<string>();

  protected readonly maxNameLength = MAX_CATEGORY_NAME_LENGTH;
  protected readonly newName = signal('');
  /** The category being renamed, and what is typed for it so far. */
  protected readonly renaming = signal<{ id: string; name: string } | undefined>(undefined);

  protected readonly newNameError = computed(() =>
    isCategoryNameTaken(this.categories(), this.newName())
      ? 'A category with this name already exists.'
      : undefined,
  );
  protected readonly canAdd = computed(
    () => this.newName().trim() !== '' && this.newNameError() === undefined,
  );
  protected readonly renameError = computed(() => {
    const draft = this.renaming();
    return draft !== undefined && isCategoryNameTaken(this.categories(), draft.name, draft.id)
      ? 'A category with this name already exists.'
      : undefined;
  });
  protected readonly canRename = computed(
    () => (this.renaming()?.name.trim() ?? '') !== '' && this.renameError() === undefined,
  );

  protected submitNew(event: SubmitEvent): void {
    event.preventDefault();
    if (!this.canAdd()) return;
    this.add.emit(this.newName().trim());
    this.newName.set('');
  }

  protected startRename(category: FinanceCategory): void {
    this.renaming.set({ id: category.id, name: category.name });
  }

  protected typeRename(event: Event): void {
    this.renaming.update((draft) =>
      draft === undefined ? draft : { ...draft, name: fieldValue(event) },
    );
  }

  protected submitRename(event: SubmitEvent): void {
    event.preventDefault();
    const draft = this.renaming();
    if (draft === undefined || !this.canRename()) return;
    this.rename.emit({ categoryId: draft.id, name: draft.name.trim() });
    this.renaming.set(undefined);
  }

  protected cancelRename(): void {
    this.renaming.set(undefined);
  }

  protected readonly valueOf = fieldValue;
}
