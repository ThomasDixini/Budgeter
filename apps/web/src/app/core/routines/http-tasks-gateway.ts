import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Task } from './task';
import { TasksGateway } from './tasks-gateway';

const TASKS_URL = '/api/tasks';
const COMPLETIONS_URL = '/api/task-completions';

/** Tasks and their completions stored by the Budgeter API. */
@Injectable()
export class HttpTasksGateway extends TasksGateway {
  private readonly httpClient = inject(HttpClient);

  override list(): Observable<readonly Task[]> {
    return this.httpClient.get<readonly Task[]>(TASKS_URL);
  }

  override save(task: Task): Observable<Task> {
    return this.httpClient.put<Task>(taskUrl(task.id), task);
  }

  override delete(taskId: string): Observable<void> {
    return this.httpClient.delete<void>(taskUrl(taskId));
  }

  override completedOn(isoDay: string): Observable<readonly string[]> {
    return this.httpClient.get<readonly string[]>(COMPLETIONS_URL, { params: { date: isoDay } });
  }

  override setDone(taskId: string, isoDay: string, isDone: boolean): Observable<void> {
    const url = `${taskUrl(taskId)}/completions/${encodeURIComponent(isoDay)}`;
    return isDone ? this.httpClient.put<void>(url, null) : this.httpClient.delete<void>(url);
  }
}

function taskUrl(taskId: string): string {
  return `${TASKS_URL}/${encodeURIComponent(taskId)}`;
}
