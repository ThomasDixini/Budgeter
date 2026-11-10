import { Component } from '@angular/core';
import { ModuleIcon } from '../../../components/module-icon/module-icon';

/** The glass dome at the bottom of the sign-in screen, holding the module icons and a lock. */
@Component({
  selector: 'app-login-dome',
  imports: [ModuleIcon],
  templateUrl: './login-dome.html',
  styleUrl: './login-dome.css',
})
export class LoginDome {}
