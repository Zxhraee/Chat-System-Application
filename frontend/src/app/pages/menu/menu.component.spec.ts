import { TestBed } from '@angular/core/testing';
import { MenuComponent } from './menu.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('MenuComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuComponent, HttpClientTestingModule],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(MenuComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
