import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterModule } from '@angular/router';
import { NavbarComponent } from '../../ui/navbar/navbar.component';
import { ProfileService } from '../../../core/services/profile.service';
import { AlertService } from '../../../core/services/alert.service';
import { AuthService } from '../../../core/auth/auth.service';
import { UserProfile, UserPreference, UserProfileFull } from '../../../core/models/user-profile.model';

type SettingsTab = 'profile' | 'preferences' | 'account';

const TRAVEL_STYLES = ['Culturale', 'Avventura', 'Relax', 'Gastronomico', 'Romantico', 'Sportivo', 'Lusso', 'Backpacking'];
const PACES = ['Lento', 'Moderato', 'Intenso'];
const TRANSPORTS = ['Auto', 'Treno', 'Aereo', 'Barca', 'Bus', 'Bicicletta', 'A piedi'];

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterModule, NavbarComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
  private profileService = inject(ProfileService);
  private alertService = inject(AlertService);
  private authService = inject(AuthService);
  private router = inject(Router);

  readonly TRAVEL_STYLES = TRAVEL_STYLES;
  readonly PACES = PACES;
  readonly TRANSPORTS = TRANSPORTS;

  activeTab = signal<SettingsTab>('profile');
  isLoading = signal(true);
  isSavingProfile = signal(false);
  isSavingPreferences = signal(false);
  isUploadingAvatar = signal(false);
  isUploadingBackground = signal(false);

  // Data
  email = signal('');
  authProvider = signal('');

  // Profile form
  name = signal('');
  surname = signal('');
  city = signal('');
  street = signal('');
  birthDate = signal('');
  avatarUrl = signal('');
  backgroundImageUrl = signal('');
  bio = signal('');
  instagramUrl = signal('');
  twitterUrl = signal('');
  pageBackground = signal('');

  // Preferences form
  travelStyle = signal('');
  pace = signal('');
  preferredTransport = signal('');
  prefersNightlife = signal<boolean>(false);
  familyFriendly = signal<boolean>(false);
  notes = signal('');

  // Computed display name
  displayName = computed(() => {
    const n = this.name();
    const s = this.surname();
    if (n || s) return `${n} ${s}`.trim();
    return this.email() || 'Il tuo profilo';
  });

  // Age computed from birthDate
  age = computed(() => {
    const d = this.birthDate();
    if (!d) return null;
    const birth = new Date(d);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const hasPassed = today.getMonth() > birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
    if (!hasPassed) age--;
    return age > 0 ? age : null;
  });

  ngOnInit() {
    this.profileService.getMyProfile().subscribe(data => {
      if (data) this.hydrateFromData(data);
      this.isLoading.set(false);

      if (!this.backgroundImageUrl()) {
        this.profileService.getRandomLocationImage().subscribe(res => {
          if (res?.imageUrl) this.pageBackground.set(res.imageUrl);
        });
      } else {
        this.pageBackground.set(this.backgroundImageUrl());
      }
    });
  }

  private hydrateFromData(data: UserProfileFull) {
    this.email.set(data.email ?? '');
    this.authProvider.set(data.authProvider ?? '');

    const p = data.profile;
    if (p) {
      this.name.set(p.name ?? '');
      this.surname.set(p.surname ?? '');
      this.city.set(p.city ?? '');
      this.street.set(p.street ?? '');
      this.avatarUrl.set(p.avatarUrl ?? '');
      this.backgroundImageUrl.set(p.backgroundImageUrl ?? '');
      this.bio.set(p.bio ?? '');
      this.instagramUrl.set(p.instagramUrl ?? '');
      this.twitterUrl.set(p.twitterUrl ?? '');
      if (p.birthDate) {
        this.birthDate.set(new Date(p.birthDate).toISOString().split('T')[0]);
      }
    }

    const pref = data.preference;
    if (pref) {
      this.travelStyle.set(pref.travelStyle ?? '');
      this.pace.set(pref.pace ?? '');
      this.preferredTransport.set(pref.preferredTransport ?? '');
      this.prefersNightlife.set(pref.prefersNightlife ?? false);
      this.familyFriendly.set(pref.familyFriendly ?? false);
      this.notes.set(pref.notes ?? '');
    }
  }

  setTab(tab: SettingsTab) {
    this.activeTab.set(tab);
  }

  saveProfile() {
    this.isSavingProfile.set(true);
    const payload: Partial<UserProfile> = {
      name: this.name(),
      surname: this.surname(),
      city: this.city(),
      street: this.street(),
      bio: this.bio(),
      instagramUrl: this.instagramUrl(),
      twitterUrl: this.twitterUrl(),
      birthDate: this.birthDate() ? new Date(this.birthDate()).toISOString() : null,
    };

    this.profileService.updateProfile(payload).subscribe(res => {
      this.isSavingProfile.set(false);
      if (res?.success) {
        this.alertService.success('Profilo aggiornato con successo!');
      } else {
        this.alertService.error('Errore durante il salvataggio del profilo.');
      }
    });
  }

  savePreferences() {
    this.isSavingPreferences.set(true);
    const payload: Partial<UserPreference> = {
      travelStyle: this.travelStyle() || null,
      pace: this.pace() || null,
      preferredTransport: this.preferredTransport() || null,
      prefersNightlife: this.prefersNightlife(),
      familyFriendly: this.familyFriendly(),
      notes: this.notes() || null,
    };

    this.profileService.updatePreferences(payload).subscribe(res => {
      this.isSavingPreferences.set(false);
      if (res?.success) {
        this.alertService.success('Preferenze salvate!');
      } else {
        this.alertService.error('Errore durante il salvataggio delle preferenze.');
      }
    });
  }

  onAvatarFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.isUploadingAvatar.set(true);
    this.profileService.uploadAvatar(file).subscribe(res => {
      this.isUploadingAvatar.set(false);
      if (res?.url) {
        this.avatarUrl.set(res.url);
        this.alertService.success('Foto profilo aggiornata!');
      } else {
        this.alertService.error('Errore upload avatar.');
      }
    });
  }

  onBackgroundFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.isUploadingBackground.set(true);
    this.profileService.uploadBackground(file).subscribe(res => {
      this.isUploadingBackground.set(false);
      if (res?.url) {
        this.backgroundImageUrl.set(res.url);
        this.pageBackground.set(res.url);
        this.alertService.success('Immagine di sfondo aggiornata!');
      } else {
        this.alertService.error('Errore upload sfondo.');
      }
    });
  }

  logout() {
    this.authService.Logout();
    this.router.navigate(['/login']);
  }

  isLocalAuth = computed(() => this.authProvider() === 'local');
}
