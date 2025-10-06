import { Component } from '@angular/core';
import { Router, RouterLink} from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  username = '';
  password = '';
  error = '';

  constructor(private auth: AuthService, private router: Router) {}

  //Submit User Credentials
 submit(){
  this.error = '';
  this.auth.login(this.username, this.password).subscribe({
    next: (user) => {
      if (!user) { this.error = 'Invalid user credentials'; return; }
      this.router.navigate(['/menu']);
    },
    error: () => this.error = 'Login failed',
  });
 }
}