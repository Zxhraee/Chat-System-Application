//imports
import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';
import { AuthGuard } from './auth.guard';

//AuthGuard test group
describe('authGuard', () => {
  //recieve normal guard paramaters and run inside Angular DI/injector
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => AuthGuard(...guardParameters));
  //set up clean angular testing mode before each test
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });
  //check helper exists 
  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
