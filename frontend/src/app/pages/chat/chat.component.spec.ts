import { TestBed } from '@angular/core/testing';
import { ChatComponent } from './chat.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { ChatService } from '../../services/chat.service';

class MockChatService {
  //replace real chat service with mock for testing
  streamMessages(_channelId: string) { return of([]); }
  sendMessage(_channelId: string, _text: string) { return of({}); }
  joinChannel(_groupId: string, _channelName: string) {}
  leaveChannel() {}
}

describe('ChatComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      //import testing module
      imports: [ChatComponent, HttpClientTestingModule],
      providers: [
        { provide: ChatService, useClass: MockChatService },
        {
          // Provide fake route params component can read during the test
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ groupId: 'G1', channelName: 'general' })),
            snapshot: { paramMap: convertToParamMap({ groupId: 'G1', channelName: 'general' }) },
          },
        },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ChatComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
