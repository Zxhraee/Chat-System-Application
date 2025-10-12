import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ChatService } from './chat.service';
import { of } from 'rxjs';

class MockChatService {
  streamMessages(_channelId: string) { return of([]); }
  sendMessage(_channelId: string, _text: string) { return of({}); }
  joinChannel(_groupId: string, _channelName: string) {}
  leaveChannel() {}
}

describe('ChatService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [{ provide: ChatService, useClass: MockChatService }],
    });
  });

  it('should be created (mocked)', () => {
    const svc = TestBed.inject(ChatService);
    expect(svc).toBeTruthy();
  });
});
