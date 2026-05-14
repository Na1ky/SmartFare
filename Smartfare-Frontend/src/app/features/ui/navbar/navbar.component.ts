import { Component, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from "@angular/router";
import { AuthService } from '../../../core/auth/auth.service';
import { AlertService } from '../../../core/services/alert.service';
import { TopNavbarComponent } from "../top-navbar/top-navbar.component";
import { SocialAuthService } from '@abacritt/angularx-social-login';
import { ItineraryService } from '../../../core/services/itinerary.service';

interface NavItem {
  icon: string;
  label: string;
  route: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [FormsModule, RouterLink, TopNavbarComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent {

  constructor(
    private authService: AuthService,
    private router: Router,
    private alertService: AlertService,
    private socialAuthService: SocialAuthService,
    private itineraryService: ItineraryService
  ) { };

  readonly navItems: NavItem[] = [
    { icon: 'bi bi-house-door', label: 'Home', route: '/home' },
    { icon: 'bi bi-compass', label: 'Esplora', route: '/discover' },
    { icon: 'bi bi-journal-bookmark', label: 'Crea', route: '/itineraries/new' },
    { icon: 'bi bi-magic', label: 'AI Planner', route: '/voyager' }
  ];

  mobileMenuOpen = false;

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    this.syncBodyScroll();
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
    this.syncBodyScroll();
  }

  get isAuthenticated() {
    return this.authService.IsAuthenticated();
  }

  get userAvatar() {
    const avatar = this.authService.getUserData()?.avatarUrl;
    return avatar;
  }

  async login() {
    this.closeMobileMenu();
    try {
      await this.socialAuthService.signOut(true);
    } catch {
    }
    this.router.navigate(['/login']);
  }

  async logout() {
    this.closeMobileMenu();

    try {
      await this.socialAuthService.signOut(true);
    } catch {
    }

    this.authService.Logout();
    this.itineraryService.clearDraft();
    this.alertService.show('Logout effettuato con successo!');
    this.router.navigate(['/']);
  }

  openAiPlanner(event?: Event) {
    event?.preventDefault();
    this.closeMobileMenu();
    this.router.navigate(['/voyager'], {
      queryParams: {
        sessionId: null,
        prompt: null
      }
    });
  }

  private syncBodyScroll(): void {
    document.body.style.overflow = this.mobileMenuOpen ? 'hidden' : '';
  }
}
