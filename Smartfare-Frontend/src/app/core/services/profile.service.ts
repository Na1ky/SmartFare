import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserProfile, UserPreference, UserProfileFull } from '../models/user-profile.model';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private readonly API_URL = `${environment.apiUrl}/api/profile`;

  constructor(private http: HttpClient) {}

  getMyProfile(): Observable<UserProfileFull | null> {
    return this.http.get<UserProfileFull>(`${this.API_URL}/me`).pipe(
      catchError(() => of(null))
    );
  }

  getProfileById(id: number): Observable<UserProfileFull | null> {
    return this.http.get<UserProfileFull>(`${this.API_URL}/${id}`).pipe(
      catchError(() => of(null))
    );
  }

  searchUsers(q: string, limit: number = 10): Observable<UserProfileFull[]> {
    return this.http.get<UserProfileFull[]>(`${this.API_URL}/search`, {
      params: { q, limit: limit.toString() }
    }).pipe(
      catchError(() => of([]))
    );
  }

  getTopCreators(limit: number = 10): Observable<UserProfileFull[]> {
    return this.http.get<UserProfileFull[]>(`${this.API_URL}/top-creators`, {
      params: { limit: limit.toString() }
    }).pipe(
      catchError(() => of([]))
    );
  }

  getRandomLocationImage(): Observable<{ imageUrl: string } | null> {
    return this.http.get<{ imageUrl: string }>(`${environment.apiUrl}/api/locations/random-image`).pipe(
      catchError(() => of(null))
    );
  }

  updateProfile(data: Partial<UserProfile>): Observable<{ success: boolean; profile: UserProfile } | null> {
    return this.http.patch<{ success: boolean; profile: UserProfile }>(`${this.API_URL}/me`, data).pipe(
      catchError(() => of(null))
    );
  }

  updatePreferences(data: Partial<UserPreference>): Observable<{ success: boolean; preference: UserPreference } | null> {
    return this.http.patch<{ success: boolean; preference: UserPreference }>(`${this.API_URL}/preferences`, data).pipe(
      catchError(() => of(null))
    );
  }

  uploadAvatar(file: File): Observable<{ success: boolean; url: string } | null> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<{ success: boolean; url: string }>(`${this.API_URL}/upload/avatar`, formData).pipe(
      catchError(() => of(null))
    );
  }

  uploadBackground(file: File): Observable<{ success: boolean; url: string } | null> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<{ success: boolean; url: string }>(`${this.API_URL}/upload/background`, formData).pipe(
      catchError(() => of(null))
    );
  }

  // ─── Follow System ───────────────────────────────────
  private readonly FOLLOW_API_URL = `${environment.apiUrl}/api/follow`;

  followUser(userId: number): Observable<{ success: boolean } | null> {
    return this.http.post<{ success: boolean }>(`${this.FOLLOW_API_URL}/${userId}`, {}).pipe(
      catchError(() => of(null))
    );
  }

  unfollowUser(userId: number): Observable<{ success: boolean } | null> {
    return this.http.delete<{ success: boolean }>(`${this.FOLLOW_API_URL}/${userId}`).pipe(
      catchError(() => of(null))
    );
  }

  getFollowStatus(userId: number): Observable<{ isFollowing: boolean } | null> {
    return this.http.get<{ isFollowing: boolean }>(`${this.FOLLOW_API_URL}/status/${userId}`).pipe(
      catchError(() => of(null))
    );
  }
}
