import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';
import { RoleGuard } from './role.guard';

//start roleguard test
describe('roleGuard', () => {
  //helper function to run roleguard in angular injection
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => RoleGuard(...guardParameters));
  //before each test setup clean angular testing module
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  //confirm guard function exists
  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
