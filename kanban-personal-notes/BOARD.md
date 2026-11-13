# Kanban – Routines & Goals · Notes

Source PRD: [../prd-personal-notes.md](../prd-personal-notes.md)

## How to run this board with AI agents
- Tasks in the same wave are safe to run **in parallel** (one agent, session or git worktree per task): they share no files.
- Start a wave only when every task in the previous wave is in `done/`.
- To work a task: move its file to `in-progress/`, set `status`, implement, verify the acceptance criteria and the project gates (AGENTS.md: lint, typecheck, tests), then move it to `done/`.
- Each task is self-contained: give an agent just the task file. Where a task says "mirror X", read X first; the pattern is the spec.
- API commands run from the repo root (`dotnet build Orbit.slnx`, `dotnet test Orbit.slnx`, `dotnet format Orbit.slnx --no-restore --verify-no-changes`); web commands from `apps/web` (`npm run lint`, `npx ng test --no-watch`, `npx prettier --check .`).
- **Commits:** agents never `git add` or commit; the coordinator commits per task with explicit paths. The pre-commit hook re-stages the working copy of every staged file, so never stage a file that has unrelated edits.
- Web specs share one jsdom; browser storage is cleared after every test (src/jsdom-canvas.testing.ts).
- Translator gotcha (hit by the sinking funds board): a PT-BR key containing `{placeholder}` acts as a pattern and can shadow existing sentences. Run the full web suite after adding keys; if `translator.spec.ts` fails, rename the new key and report.

## Execution plan
| Wave | Tasks | Max parallel agents |
|------|-------|---------------------|
| 1 | 101, 102, 103, 104 | 4 |
| 2 | 201, 202, 203, 204 | 4 |
| 3 | 301, 302, 303 | 3 |
| 4 | 401 | 1 |
| 5 | 501 | 1 |

## Shared interfaces (pinned; every task conforms to these)

### Wire format (JSON, camelCase, enums as camelCase strings)
```
GET    /api/notes                  -> NoteResponse[]   (most recently updated first, then by id)
PUT    /api/notes/{id}             body { kind, title, body } -> NoteResponse   (creates as "open", or edits)
PUT    /api/notes/{id}/status      body { status } -> NoteResponse               (404 when the note does not exist)
DELETE /api/notes/{id}             -> 204 (unknown id ignored)

NoteKind    = "goal" | "note" | "idea"
NoteStatus  = "open" | "done" | "archived"
NoteResponse = { id, kind, title, body, status, createdAt, updatedAt }   // timestamps: UTC ISO-8601 with offset, set by the API
```
Rules (domain): title trimmed, 1-80 chars; body 0-4000 chars, a missing body is `""`; `done` only for kinds `goal` and `idea`; editing keeps `createdAt` and `status`; editing or changing status sets `updatedAt = now`; editing a `done` item to kind `note` is rejected. Violations are `DomainRuleException`s whose message names the value and the expected shape (400 through the existing exception handler).

### Server types (C#, `Orbit.Api.Domain.Notes` / `Orbit.Api.Application.Notes`)
```csharp
public enum NoteKind { Goal, Note, Idea }          // task 101
public enum NoteStatus { Open, Done, Archived }
public sealed class Note {
    public const int MaxTitleLength = 80; public const int MaxBodyLength = 4000;
    string Id; NoteKind Kind; string Title; string Body; NoteStatus Status; DateTimeOffset CreatedAt; DateTimeOffset UpdatedAt;
    static Note Create(string id, NoteKind kind, string title, string body, DateTimeOffset now);   // status Open
    internal static Note Restore(string id, NoteKind kind, string title, string body, NoteStatus status, DateTimeOffset createdAt, DateTimeOffset updatedAt);
    Note Edited(NoteKind kind, string title, string body, DateTimeOffset now);
    Note WithStatus(NoteStatus status, DateTimeOffset now); }
public interface INoteRepository {                  // task 101 (Application/Notes)
    Task<Note?> FindAsync(string id, CancellationToken ct);
    Task<IReadOnlyList<Note>> ListAsync(CancellationToken ct);              // updated_at desc, then id
    Task SaveAsync(Note note, CancellationToken ct);                        // upsert by id
    Task DeleteAsync(string id, CancellationToken ct); }                    // unknown id ignored
// task 201 (constructors: SaveNote(INoteRepository, TimeProvider), SetNoteStatus(INoteRepository, TimeProvider), DeleteNote(INoteRepository), ListNotes(INoteRepository))
public sealed record SaveNoteCommand(string Id, NoteKind Kind, string Title, string? Body);
public sealed record SetNoteStatusCommand(string Id, NoteStatus Status);
public sealed class SaveNote      { Task<Note> ExecuteAsync(SaveNoteCommand, CancellationToken); }
public sealed class SetNoteStatus { Task<Note> ExecuteAsync(SetNoteStatusCommand, CancellationToken); }   // ResourceNotFoundException.For("note", id)
public sealed class DeleteNote    { Task ExecuteAsync(string id, CancellationToken); }
public sealed class ListNotes     { Task<IReadOnlyList<Note>> ExecuteAsync(CancellationToken); }
```

### Web types (TypeScript, `apps/web/src/app/core/routines/`)
```ts
// notes.ts (task 102)
export type NoteKind = 'goal' | 'note' | 'idea';
export type NoteStatus = 'open' | 'done' | 'archived';
export interface Note { readonly id: string; readonly kind: NoteKind; readonly title: string; readonly body: string; readonly status: NoteStatus; readonly createdAt: string; readonly updatedAt: string; }
export interface NoteDraft { readonly kind: NoteKind; readonly title: string; readonly body: string; }
export const NOTE_TITLE_MAX = 80; export const NOTE_BODY_MAX = 4000;
// notes-gateway.ts (task 102)
export abstract class NotesGateway {
  abstract list(): Observable<readonly Note[]>;
  abstract save(id: string, draft: NoteDraft): Observable<Note>;
  abstract setStatus(id: string, status: NoteStatus): Observable<Note>;
  abstract delete(id: string): Observable<void>; }
// notes-filter.ts (task 103) - pure
export interface NoteFilter { readonly kind: NoteKind | 'all'; readonly status: NoteStatus; readonly query: string; }
export function filterNotes(notes: readonly Note[], filter: NoteFilter): readonly Note[];  // keeps the input order
export function matchesQuery(note: Note, query: string): boolean;                           // title or body, case- and accent-insensitive, blank query matches all
// notes-store.ts (task 203) - @Injectable(), provided by the page
export class NotesStore {
  readonly notes: Signal<readonly Note[]>;            // updatedAt desc, then id
  readonly isLoaded: Signal<boolean>; readonly hasLoadFailed: Signal<boolean>; readonly hasActionFailed: Signal<boolean>;
  reload(): void;
  save(draft: NoteDraft, id?: string): void;          // a new id comes from IdGenerator when omitted
  addIdea(title: string): void;                       // trims; blank does nothing; kind 'idea', body ''
  setStatus(id: string, status: NoteStatus): void;
  remove(id: string): void;
  readonly savedCount: Signal<number>; }              // saves the API accepted (forms wait for it to grow)
```
Components (tasks 302/303): `NoteItem` (`app-note-item`; input `note: Note`; outputs `edit: Note`, `statusChange: { note: Note; status: NoteStatus }`, `remove: Note`) and `NoteForm` (`app-note-form`; inputs `note: Note | null`; outputs `saved: { id: string | null; draft: NoteDraft }`, `cancelled: void`; when editing a `done` note the kind select has no "Note" option).

### Translation keys (English text is the key; PT-BR owned by task 104)
If a key already exists with the same PT-BR value, skip it; with a different value, STOP and report.
| English | PT-BR |
|---|---|
| Notes | Notas |
| New note | Nova nota |
| Edit note | Editar nota |
| Quick idea | Ideia rápida |
| Jot down an idea | Anote uma ideia |
| Add idea | Adicionar ideia |
| All notes | Todas |
| Goals | Metas |
| Ideas | Ideias |
| Goal | Meta |
| Note | Nota |
| Idea | Ideia |
| Open notes | Abertas |
| Done notes | Feitas |
| Archived notes | Arquivadas |
| Marked as done | Marcado como feito |
| Mark as done | Marcar como feito |
| Reopen | Reabrir |
| Archive | Arquivar |
| Restore | Restaurar |
| Edit note {title} | Editar nota {title} |
| Mark note {title} as done | Marcar a nota {title} como feita |
| Reopen note {title} | Reabrir a nota {title} |
| Archive note {title} | Arquivar a nota {title} |
| Restore note {title} | Restaurar a nota {title} |
| Delete note {title} | Excluir nota {title} |
| Note kind | Tipo da nota |
| Note title | Título da nota |
| Note text | Texto da nota |
| {count} / {max} characters | {count} / {max} caracteres |
| Last edited {date} | Editada em {date} |
| Search notes | Buscar notas |
| Filter notes by kind | Filtrar notas por tipo |
| Filter notes by status | Filtrar notas por status |
| No notes yet. Write down a goal, a note or an idea. | Nenhuma nota ainda. Anote uma meta, uma nota ou uma ideia. |
| Nothing matches these filters. | Nada corresponde a esses filtros. |
| Clear filters | Limpar filtros |
| Could not load the notes. | Não foi possível carregar as notas. |
| Could not save the note. | Não foi possível salvar a nota. |
| Could not update the note. | Não foi possível atualizar a nota. |

## File ownership map
| File | Owned by task |
|------|---------------|
| apps/api/Domain/Notes/NoteKind.cs, NoteStatus.cs, Note.cs | 101 |
| apps/api/Application/Notes/INoteRepository.cs | 101 |
| apps/api/tests/Orbit.Api.Tests/Domain/NoteTests.cs | 101 |
| apps/web/src/app/core/routines/notes.ts, notes-gateway.ts, http-notes-gateway.ts, http-notes-gateway.spec.ts, fake-notes-gateway.ts | 102 |
| apps/web/src/app/app.config.ts | 102 (HTTP binding), then 204 (demo switch) |
| apps/web/src/app/core/routines/notes-filter.ts, notes-filter.spec.ts | 103 |
| apps/web/src/app/core/i18n/translations/pt-br-routines.ts | 104 |
| apps/api/Application/Notes/SaveNote.cs, SetNoteStatus.cs, DeleteNote.cs, ListNotes.cs | 201 |
| apps/api/tests/Orbit.Api.Tests/Fakes/InMemoryNoteRepository.cs, Application/NoteUseCaseTests.cs | 201 |
| apps/api/Infrastructure/Sqlite/SqliteSchema.cs, SqliteNoteRepository.cs, SqlitePersistenceRegistration.cs | 202 |
| apps/api/tests/Orbit.Api.Tests/Infrastructure/SqliteNoteRepositoryTests.cs | 202 |
| apps/web/src/app/core/routines/notes-store.ts, notes-store.spec.ts | 203 |
| apps/web/src/app/core/routines/demo/demo-notes.ts, demo-notes.spec.ts | 204 |
| apps/api/Endpoints/NoteEndpoints.cs, apps/api/Program.cs, tests/.../Endpoints/NoteEndpointsTests.cs | 301 |
| apps/web/src/app/pages/routines/notes/note-item/note-item.* | 302 |
| apps/web/src/app/pages/routines/notes/note-form/note-form.* | 303 |
| apps/web/src/app/pages/routines/notes/notes.ts/.html/.css/.spec.ts, routines.routes.ts, core/routines/routines-section.ts (+ any existing spec that counts the tabs) | 401 |
| apps/web/e2e/notes.e2e.ts, apps/web/e2e/pages/notes.page.ts, TODO.md | 501 |

## Backlog
| ID | Wave | Task | Priority | Estimate | Depends on |
|----|------|------|----------|----------|------------|
| 501 | 5 | E2E test and TODO ticks | medium | S | 301, 401 |

## In progress
_(empty)_

## Done
| ID | Task |
|----|------|
| 101 | API domain: Note, kind, status, repository port |
| 102 | Web model, gateway port, HTTP + fake gateways |
| 103 | Web pure filter and search |
| 104 | Web PT-BR translations |
| 201 | API use cases (+ in-memory fake) |
| 202 | SQLite table and repository |
| 203 | Web NotesStore |
| 204 | Web demo gateway and binding |
| 301 | API endpoints, DI registration, endpoint tests |
| 302 | Web NoteItem component |
| 303 | Web NoteForm component |
| 401 | Notes page, route and tab |
