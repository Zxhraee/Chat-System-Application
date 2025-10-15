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
  //inputs
  username = '';
  password = '';
  //string to store error
  error = '';

  constructor(private auth: AuthService, private router: Router) {}

 submit(){
  //clear previous error before login
  this.error = '';
  this.auth.login(this.username, this.password).subscribe({
    next: (user) => {
      //return to menu if invalid user credentials
      if (!user) { this.error = 'Invalid user credentials'; return; }
      this.router.navigate(['/menu']);
    },
    error: () => this.error = 'Login failed',
  });
 }
}