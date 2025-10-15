import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

//Start App component test
describe('AppComponent', () => {
  //before test
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, HttpClientTestingModule],
    }).compileComponents();
  });

  //Verify component can be started and exists
  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  //Check valid title
  it('should have the correct title value', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app: any = fixture.componentInstance;
    expect(app.title).toBe('Chat System');
  });

});
