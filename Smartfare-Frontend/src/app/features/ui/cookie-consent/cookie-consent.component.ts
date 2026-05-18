import { Component, OnInit, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CookieConsentService, CookiePrefs } from '../../../core/services/cookie-consent.service';

@Component({
  selector: 'sf-cookie-consent',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cookie-consent.component.html',
  styleUrl: './cookie-consent.component.css'
})
export class CookieConsentComponent implements OnInit {
  @HostBinding('class.sf-theme-dark') darkMode = false;
  visible   = false;
  modalOpen = false;
  tab: 'info' | 'prefs' = 'info';

  prefs: CookiePrefs = { necessary: true, functional: false, analytics: false, marketing: false };

  constructor(private consent: CookieConsentService) {}

  ngOnInit(): void {
    this.visible = !this.consent.hasConsented();
    const saved = this.consent.getPreferences();
    if (saved) this.prefs = { ...saved };
    // enable dark theme for the component when the site/body indicates dark mode
    try {
      this.darkMode = document.body.classList.contains('theme-dark') || window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      this.darkMode = false;
    }
  }

  openModal(): void  { this.modalOpen = true; this.tab = 'info'; }
  closeModal(): void { this.modalOpen = false; }

  onOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('sf-overlay')) this.closeModal();
  }

  acceptAll(): void {
    this.consent.acceptAll();
    this.visible = false;
    this.modalOpen = false;
  }

  rejectAll(): void {
    this.consent.rejectAll();
    this.visible = false;
    this.modalOpen = false;
  }

  saveAndClose(): void {
    this.prefs.necessary = true;
    this.consent.savePreferences(this.prefs);
    this.visible = false;
    this.modalOpen = false;
  }
}
