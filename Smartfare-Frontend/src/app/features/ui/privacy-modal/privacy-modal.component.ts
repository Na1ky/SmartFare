import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'sf-privacy-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: `./privacy-modal.component.html`,
  styleUrl: `./privacy-modal.component.css`
})
export class PrivacyModalComponent {
  @Output() close = new EventEmitter<void>();

  onClose() {
    this.close.emit();
  }
}
