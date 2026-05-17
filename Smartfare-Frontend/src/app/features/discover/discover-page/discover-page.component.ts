import { Component, OnInit, inject, signal, computed, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { NavbarComponent } from '../../ui/navbar/navbar.component';
import { FooterComponent } from '../../ui/footer/footer.component';
import { AppLoaderComponent } from '../../ui/loader/loader.component';
import { ItineraryService } from '../../../core/services/itinerary.service';
import { ProfileService } from '../../../core/services/profile.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Itinerary } from '../../../core/models/itinerary.model';
import { UserProfileFull } from '../../../core/models/user-profile.model';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, forkJoin } from 'rxjs';

type FilterType = 'all' | 'itineraries' | 'explorers' | 'destinations';

@Component({
  selector: 'app-discover-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NavbarComponent, FooterComponent, AppLoaderComponent],
  templateUrl: './discover-page.component.html',
  styleUrl: './discover-page.component.css'
})
export class DiscoverPageComponent implements OnInit, OnDestroy {
  private readonly itineraryService = inject(ItineraryService);
  private readonly profileService = inject(ProfileService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // State
  isLoading = signal(true);
  activeFilter = signal<FilterType>('all');
  searchQuery = signal('');
  
  // Data
  trendingItineraries = signal<Itinerary[]>([]);
  featuredItineraries = signal<Itinerary[]>([]);
  topCreators = signal<UserProfileFull[]>([]);
  nearYourTrips = signal<Itinerary[]>([]);
  
  // Search Results
  isSearching = signal(false);
  searchResultsItineraries = signal<Itinerary[]>([]);
  searchResultsUsers = signal<UserProfileFull[]>([]);
  
  // Subjects
  private searchSubject = new Subject<string>();

  get isAuthenticated() {
    return this.authService.IsAuthenticated();
  }

  ngOnInit() {
    this.loadInitialData();
    this.setupSearch();
  }

  ngOnDestroy() {
    this.searchSubject.complete();
  }

  private loadInitialData() {
    this.isLoading.set(true);

    // Parallel loading of discovery data
    const requests = [
      this.itineraryService.getPublicItineraries({ trending: true }),
      this.profileService.getTopCreators(6)
    ];

    forkJoin(requests).subscribe({
      next: ([trendingItins, creators]: any[]) => {
        // Trending
        this.trendingItineraries.set(trendingItins);
        
        // Use first 3 trending as featured if available
        this.featuredItineraries.set(trendingItins.slice(0, 3));
        
        // Top Creators
        this.topCreators.set(creators);
        
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });

    // If authenticated, load Near Your Trips
    if (this.isAuthenticated) {
      this.itineraryService.getMyItineraries().subscribe(myItins => {
        if (myItins && myItins.length > 0) {
          // Get the location of the most recent itinerary
          const latestLocationId = myItins[0].locationId;
          if (latestLocationId) {
            this.itineraryService.getPublicItineraries({ locationId: latestLocationId }).subscribe(nearItins => {
              // Filter out own itineraries
              const othersNearItins = nearItins.filter(it => it.userId !== myItins[0].userId);
              this.nearYourTrips.set(othersNearItins);
            });
          }
        }
      });
    }
  }

  private setupSearch() {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || query.length < 2) {
          this.isSearching.set(false);
          this.searchResultsItineraries.set([]);
          this.searchResultsUsers.set([]);
          return of(null);
        }

        this.isSearching.set(true);
        return forkJoin([
          this.itineraryService.getPublicItineraries({ q: query }),
          this.profileService.searchUsers(query)
        ]);
      })
    ).subscribe(results => {
      if (results) {
        this.searchResultsItineraries.set(results[0]);
        this.searchResultsUsers.set(results[1]);
      }
      this.isSearching.set(false);
    });
  }

  onSearchChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.searchSubject.next(value);
  }

  setFilter(filter: FilterType) {
    this.activeFilter.set(filter);
  }

  clearSearch() {
    this.searchQuery.set('');
    this.searchSubject.next('');
  }

  toggleFollow(user: UserProfileFull, event: Event) {
    event.stopPropagation();
    if (!this.isAuthenticated) {
      this.router.navigate(['/login']);
      return;
    }

    // Identify user id inside profile structure (or fallback to user profile ID logic)
    // Actually the new endpoint returns `id` as user id! So we need to cast or access it.
    const userId = (user as any).id;
    if (!userId) return;

    if (user.isFollowing) {
      this.profileService.unfollowUser(userId).subscribe(res => {
        if (res?.success) {
          this.updateUserFollowState(userId, false);
        }
      });
    } else {
      this.profileService.followUser(userId).subscribe(res => {
        if (res?.success) {
          this.updateUserFollowState(userId, true);
        }
      });
    }
  }

  private updateUserFollowState(userId: number, isFollowing: boolean) {
    // Update top creators
    this.topCreators.update(users => users.map(u => 
      (u as any).id === userId ? { ...u, isFollowing } : u
    ));
    
    // Update search results
    this.searchResultsUsers.update(users => users.map(u => 
      (u as any).id === userId ? { ...u, isFollowing } : u
    ));
  }

  getItemCount(itinerary: Itinerary): number {
    return itinerary._count?.items ?? itinerary.items?.length ?? 0;
  }

  getDuration(itinerary: Itinerary): string {
    const days = itinerary.durationDays;
    if (days != null && days > 0) {
      return `${days} ${days === 1 ? 'Giorno' : 'Giorni'}`;
    }
    return 'Durata N/A';
  }

  getCreatorName(itinerary: Itinerary): string {
    const p = itinerary.user?.profile;
    if (p?.name || p?.surname) {
      return `${p.name ?? ''} ${p.surname ?? ''}`.trim();
    }
    return 'Utente SmartFare';
  }

  getUserDisplayName(user: UserProfileFull): string {
    if (user.profile?.name || user.profile?.surname) {
      return `${user.profile.name ?? ''} ${user.profile.surname ?? ''}`.trim();
    }
    return 'Esploratore';
  }
}
