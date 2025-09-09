import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { Group } from '../../models/group';
import { Channel } from '../../models/channel';

@Component({
  selector: 'app-channels',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './channels.component.html', // or inline template
})
export class ChannelsComponent implements OnInit {
  groupId = '';
  group: Group | null = null;
  channels: Channel[] = [];
  newName = 'main';

  constructor(private route: ActivatedRoute, private router: Router, private store: StorageService) {}

  ngOnInit(): void {
    this.groupId = this.route.snapshot.paramMap.get('groupId')!;
    this.group = this.store.getGroupById(this.groupId);
    this.load();
  }

  private load() { this.channels = this.store.getChannelsByGroup(this.groupId); }

  add() {
    const name = this.newName.trim();
    if (!name) return;
    this.store.addChannel(this.groupId, name);
    this.newName = '';
    this.load();
  }

  rename(id: string) {
    const current = this.store.getChannelById(id);
    const name = prompt('Channel name', current?.name || '')?.trim();
    if (!name) return;
    this.store.renameChannel(id, name);
    this.load();
  }

  remove(id: string) {
    if (!confirm('Delete this channel?')) return;
    this.store.deleteChannel(id);
    if (!this.store.getFirstChannelId(this.groupId)) this.store.ensureDefaultChannel(this.groupId);
    this.load();
  }

  open(id: string) { this.router.navigate(['/chat', this.groupId, id]); }
}
