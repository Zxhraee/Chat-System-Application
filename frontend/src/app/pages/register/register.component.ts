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
  //inputs
  username = '';
  email = '';
  password = '';
  //string to store error and success message
  error = '';
  success = '';

  constructor(private store: StorageService, private router: Router) {}

  submit() {
    //clear error and success message
    this.error = '';
    this.success = '';

    //call API via service
    this.store.createUser(this.username, this.email, this.password).subscribe({
      next: (user) => {
        //if user exists, display error and return
        if (!user) {
          this.error = 'Username/email/password invalid or already exists.';
          return;
        }
        //create account
        this.success = 'Account created! Please log in.';
        this.username = this.email = this.password = '';
        setTimeout(() => this.router.navigate(['/login']), 300);
      },
      //message for network error
      error: (e) => {
        this.error = (e?.error?.message) || 'Failed to create account.';
      }
    });
  }
}
