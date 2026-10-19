import { Component, OnInit, inject, signal } from '@angular/core';
import { ApiService } from './core/api.service';

@Component({
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit {
  protected readonly apiMessage = signal('Loading...');
  private readonly api = inject(ApiService);

  ngOnInit(): void {
    this.api.getHello().subscribe({
      next: (message) => this.apiMessage.set(message),
      error: () => this.apiMessage.set('API unavailable'),
    });
  }
}
