import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppNotice } from './components/app-notice/app-notice';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppNotice],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
