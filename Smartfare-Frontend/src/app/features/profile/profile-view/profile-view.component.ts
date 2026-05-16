import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { NavbarComponent } from '../../ui/navbar/navbar.component';
import { ProfileService } from '../../../core/services/profile.service';
import { ItineraryService } from '../../../core/services/itinerary.service';
import { UserProfileFull } from '../../../core/models/user-profile.model';
import { Itinerary } from '../../../core/models/itinerary.model';

type ProfileTab = 'all' | 'public' | 'private';

@Component({
  selector: 'app-profile-view',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent],
  templateUrl: './profile-view.component.html',
  styleUrl: './profile-view.component.css'
})
export class ProfileViewComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly itineraryService = inject(ItineraryService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  isLoading = signal(true);
  
  // User Data
  displayName = signal('');
  age = signal<number | null>(null);
  birthDateStr = signal('');
  city = signal('');
  avatarUrl = signal('');
  pageBackground = signal('');
  bio = signal('');
  instagramUrl = signal('');
  twitterUrl = signal('');
  followersCount = signal(0);
  publicItinerariesCount = signal(0);
  
  // Follow logic
  targetUserId = signal<number | null>(null);
  isFollowing = signal(false);
  isMe = signal(true);
  isFollowingLoading = signal(false);

  // Itineraries
  allItineraries = signal<Itinerary[]>([]);
  activeTab = signal<ProfileTab>('all');

  // Computed Itineraries
  filteredItineraries = computed(() => {
    const itineraries = this.allItineraries();
    const tab = this.activeTab();
    
    if (tab === 'public') {
      return itineraries.filter(it => it.isPublished);
    } else if (tab === 'private') {
      return itineraries.filter(it => !it.isPublished);
    }
    return itineraries;
  });

  publicCount = computed(() => this.allItineraries().filter(it => it.isPublished).length);
  privateCount = computed(() => this.allItineraries().filter(it => !it.isPublished).length);

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        const targetId = Number(id);
        const currentUserId = this.authService.getUserData()?.userId;
        
        if (targetId === Number(currentUserId)) {
          this.isMe.set(true);
          this.loadMyProfile();
        } else {
          this.isMe.set(false);
          this.targetUserId.set(targetId);
          this.loadOtherProfile(targetId);
        }
      } else {
        this.isMe.set(true);
        this.loadMyProfile();
      }
    });
  }

  private loadMyProfile() {
    this.isLoading.set(true);
    this.profileService.getMyProfile().subscribe(data => {
      if (data) {
        this.hydrateFromData(data);
      }
      
      // Load itineraries
      this.itineraryService.getMyItineraries().subscribe(itineraries => {
        this.allItineraries.set(itineraries);
        this.isLoading.set(false);
      });

      this.handleBackgroundFallback();
    });
  }

  private loadOtherProfile(userId: number) {
    this.isLoading.set(true);
    this.profileService.getProfileById(userId).subscribe(data => {
      if (data) {
        this.hydrateFromData(data);
        
        // For other profiles, we only show public itineraries
        // We'll use getPublicItineraries with a filter? 
        // Or better, the backend route for public profile should return public itineraries?
        // Let's check my backend change... ah, I didn't return itineraries in GET /api/profile/:id.
        // I'll fetch them separately.
        this.itineraryService.getPublicItineraries(undefined).subscribe(allPublic => {
          // Filter for this user (this is not optimal but works for now)
          // Ideally the backend should have a route for "itineraries of user X"
          // I will use a filter on the frontend for now.
          this.allItineraries.set(allPublic.filter(it => it.userId === userId));
          this.isLoading.set(false);
        });

        // Check follow status
        this.profileService.getFollowStatus(userId).subscribe(res => {
          if (res) this.isFollowing.set(res.isFollowing);
        });
      }
      this.handleBackgroundFallback();
    });
  }

  private handleBackgroundFallback() {
    if (!this.pageBackground()) {
      this.profileService.getRandomLocationImage().subscribe(res => {
        if (res?.imageUrl) this.pageBackground.set(res.imageUrl);
      });
    }
  }

  private hydrateFromData(data: UserProfileFull) {
    const profile = data.profile;
    const name = profile?.name || '';
    const surname = profile?.surname || '';
    this.displayName.set(`${name} ${surname}`.trim() || 'Viaggiatore');
    this.city.set(profile?.city || '');
    this.avatarUrl.set(profile?.avatarUrl || '');
    this.pageBackground.set(profile?.backgroundImageUrl || '');
    this.bio.set(profile?.bio || '');
    this.instagramUrl.set(profile?.instagramUrl || '');
    this.twitterUrl.set(profile?.twitterUrl || '');
    this.followersCount.set(data.followersCount || 0);
    this.publicItinerariesCount.set(data.publicItinerariesCount || 0);

    if (profile?.birthDate) {
      const birth = new Date(profile.birthDate);
      
      // Calculate age
      const diffMs = Date.now() - birth.getTime();
      const ageDt = new Date(diffMs);
      this.age.set(Math.abs(ageDt.getUTCFullYear() - 1970));
      
      // Format birth string e.g., "15 Maggio 1999"
      const formatter = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
      this.birthDateStr.set(formatter.format(birth));
    }
  }

  setTab(tab: ProfileTab) {
    this.activeTab.set(tab);
  }

  goToSettings() {
    this.router.navigate(['/settings']);
  }

  toggleFollow() {
    const targetId = this.targetUserId();
    if (!targetId || this.isFollowingLoading()) return;

    this.isFollowingLoading.set(true);
    if (this.isFollowing()) {
      this.profileService.unfollowUser(targetId).subscribe(res => {
        this.isFollowingLoading.set(false);
        if (res?.success) {
          this.isFollowing.set(false);
          this.followersCount.update(c => c - 1);
        }
      });
    } else {
      this.profileService.followUser(targetId).subscribe(res => {
        this.isFollowingLoading.set(false);
        if (res?.success) {
          this.isFollowing.set(true);
          this.followersCount.update(c => c + 1);
        }
      });
    }
  }

  formatDateRange(itinerary: Itinerary): string {
    if (!itinerary.startDate) return 'Date da confermare';
    const start = new Date(itinerary.startDate);
    const end = itinerary.endDate ? new Date(itinerary.endDate) : null;
    const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
    const startStr = start.toLocaleDateString('it-IT', opts);
    if (!end) return startStr;
    return `${startStr} - ${end.toLocaleDateString('it-IT', opts)}`;
  }
}
