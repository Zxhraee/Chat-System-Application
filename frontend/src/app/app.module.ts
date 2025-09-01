import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { MenuComponent } from './pages/menu/menu.component';
import { AppComponent } from './app.component';

@NgModule({
imports: [BrowserModule, FormsModule],
declarations: [MenuComponent],
bootstrap: [AppComponent]
})
export class AppModule {}