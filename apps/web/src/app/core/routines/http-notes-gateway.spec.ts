import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HttpNotesGateway } from './http-notes-gateway';
import { Note, NoteDraft } from './notes';

const NOTE: Note = {
  id: 'cambly',
  kind: 'note',
  title: 'Cambly',
  body: 'Book a session',
  status: 'open',
  createdAt: '2026-11-02T10:00:00Z',
  updatedAt: '2026-11-06T10:00:00Z',
};

let httpTesting: HttpTestingController;
let gateway: HttpNotesGateway;

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), HttpNotesGateway],
  });
  httpTesting = TestBed.inject(HttpTestingController);
  gateway = TestBed.inject(HttpNotesGateway);
});

afterEach(() => httpTesting.verify());

describe('HttpNotesGateway', () => {
  it('lists notes from the API', () => {
    let received: readonly Note[] = [];

    gateway.list().subscribe((notes) => (received = notes));
    httpTesting.expectOne({ method: 'GET', url: '/api/notes' }).flush([NOTE]);

    expect(received).toEqual([NOTE]);
  });

  it('puts the draft at the escaped id', () => {
    const draft: NoteDraft = { kind: 'note', title: 'Cambly', body: 'Book a session' };

    gateway.save('n 1', draft).subscribe();

    const request = httpTesting.expectOne({ method: 'PUT', url: '/api/notes/n%201' });
    expect(request.request.body).toEqual(draft);
    request.flush(NOTE);
  });

  it('puts the new status at the status path', () => {
    let received: Note | undefined;

    gateway.setStatus('cambly', 'archived').subscribe((note) => (received = note));

    const request = httpTesting.expectOne({ method: 'PUT', url: '/api/notes/cambly/status' });
    expect(request.request.body).toEqual({ status: 'archived' });
    request.flush({ ...NOTE, status: 'archived' });
    expect(received?.status).toBe('archived');
  });

  it('deletes a note', () => {
    gateway.delete('cambly').subscribe();

    httpTesting.expectOne({ method: 'DELETE', url: '/api/notes/cambly' }).flush(null);
  });
});
