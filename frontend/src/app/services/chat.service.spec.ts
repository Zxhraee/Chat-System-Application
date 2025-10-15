import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ChatService } from './chat.service';
import { of } from 'rxjs';

//Fake tester Chat Service
class MockChatService {
  //Pretend message and send Streams
  streamMessages(_channelId: string) { return of([]); }
  sendMessage(_channelId: string, _text: string) { return of({}); }
  joinChannel(_groupId: string, _channelName: string) {}
  leaveChannel() {}
}

//Start ChatService test
describe('ChatService', () => {
  beforeEach(() => {
    //setup testing module 
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      //replace chatservice with mock 
      providers: [{ provide: ChatService, useClass: MockChatService }],
    });
  });

  //check service can be injected (mock)
  it('should be created (mocked)', () => {
    const svc = TestBed.inject(ChatService);
    expect(svc).toBeTruthy();
  });
});
