import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
  username = '';
  email = '';
  password = '';
  error = '';
  success = '';

  constructor(private store: StorageService, private router: Router) {}

  submit() {
    this.error = '';
    this.success = '';

    const u = this.store.createUser(this.username, this.email, this.password);
    if (!u) {
      this.error = 'Username already exists or fields are invalid.';
      return;
    }

    this.success = 'Account created! Please log in.';
    this.username = this.email = this.password = '';
    setTimeout(() => this.router.navigate(['/login']), 0);
  }
}
