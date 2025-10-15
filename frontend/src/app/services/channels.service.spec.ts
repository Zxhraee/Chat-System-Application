import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ChatService } from './chat.service';
import { of } from 'rxjs';

//Mock Chat Service
class MockChatService {
  //Pretend message and send Streams
  streamMessages(_channelId: string) { return of([]); }
  sendMessage(_channelId: string, _text: string) { return of({}); }
  joinChannel(_groupId: string, _channelName: string) {}
  leaveChannel() {}
}

describe('ChatService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      //setup testing module 
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [
        //replace chatservice with mock 
        { provide: ChatService, useClass: MockChatService },
      ],
    });
  });

  //channel service can be injected (mock)
  it('should be created (mocked)', () => {
    const svc = TestBed.inject(ChatService);
    expect(svc).toBeTruthy();
  });
});
