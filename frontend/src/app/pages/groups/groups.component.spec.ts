import { TestBed } from '@angular/core/testing';
import { GroupsComponent } from './groups.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('GroupsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupsComponent, HttpClientTestingModule],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(GroupsComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
