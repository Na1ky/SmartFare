import {
  AfterViewInit,
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  QueryList,
  ViewChildren,
  signal,
  ChangeDetectionStrategy,
  NgZone,
  ChangeDetectorRef,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from "../../ui/navbar/navbar.component";
import { AiPromptBarComponent } from "../ai-prompt-bar/ai-prompt-bar.component";
import { RevealOnScrollDirective } from '../../../core/directives/reveal-on-scroll.directive';
import { ItineraryService } from '../../../core/services/itinerary.service';
import { Itinerary } from '../../../core/models/itinerary.model';
import { FooterComponent } from '../../ui/footer/footer.component';
import { FeaturedItinerariesComponent } from '../featured-itineraries/featured-itineraries.component';
import { FeaturesGridComponent } from '../features-grid/features-grid.component';
import { CtaSectionComponent } from '../cta-section/cta-section.component';
import { AppLoaderComponent } from '../../ui/loader/loader.component';

@Component({
  selector: 'app-home-section',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    AiPromptBarComponent,
    RevealOnScrollDirective,
    FooterComponent,
    FeaturedItinerariesComponent,
    FeaturesGridComponent,
    CtaSectionComponent,
    AppLoaderComponent
  ],
  templateUrl: './home-section.component.html',
  styleUrl: './home-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeSectionComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren('backgroundVideo')
  private backgroundVideos!: QueryList<ElementRef<HTMLVideoElement>>;

  protected readonly publicItineraries = signal<Itinerary[]>([]);
  protected readonly isLoadingPublicItineraries = signal(true);
  private readonly itineraryService = inject(ItineraryService);

  protected readonly transitionMs = 1200;
  protected readonly videoRotationMs = 9000;
  protected readonly heroTypingLines = ['Explore the World', 'With SmartFare'];
  protected readonly videoSources = [
    'https://res.cloudinary.com/dxudggkln/video/upload/f_auto,q_auto/v1778223687/background-3_kzhy8e.mp4',
    'https://res.cloudinary.com/dxudggkln/video/upload/f_auto,q_auto/v1778223688/background-5_cjnawy.mp4',
    'https://res.cloudinary.com/dxudggkln/video/upload/f_auto,q_auto/v1778223688/background-6_zuz2zt.mp4',
  ];

  protected readonly videoLayers = [
    this.videoSources[0],
    this.videoSources[1] ?? this.videoSources[0],
  ];

  protected activeVideoLayer = 0;
  protected readonly isInitialVideoReady = signal(false);
  protected readonly heroLineTop = signal('');
  protected readonly heroLineBottom = signal('');
  protected readonly caretLine = signal<0 | 1>(0);

  private currentVideoIndex = 0;
  private queuedVideoIndex = 1;
  private rotationTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private cleanupTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private typingTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private typingStage = 0;

  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly elRef = inject(ElementRef);

  private heroObserver: IntersectionObserver | null = null;
  private isHeroVisible = true;
  private readonly reduceMotion = typeof window !== 'undefined' && (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
  );

  ngOnInit(): void {
    this.isLoadingPublicItineraries.set(true);
    this.itineraryService.getPublicItineraries().subscribe({
      next: (itineraries) => {
        this.publicItineraries.set(itineraries.filter(i => i.isPublished).slice(0, 3));
        this.isLoadingPublicItineraries.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingPublicItineraries.set(false);
        this.cdr.markForCheck();
      }
    });


    if (this.reduceMotion) {
      this.heroLineTop.set(this.heroTypingLines[0] ?? '');
      this.heroLineBottom.set(this.heroTypingLines[1] ?? '');
      this.caretLine.set(1);
      return;
    }

    // Run typing animation outside Angular zone to avoid triggering
    // change detection every 85ms, which causes scroll jank
    this.ngZone.runOutsideAngular(() => {
      this.startTypingLoop();
    });
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => {
      this.prepareVideoElements();
      this.playLayer(this.activeVideoLayer);
    });

    if (!this.reduceMotion) {
      this.scheduleNextTransition();
    }

    if (typeof IntersectionObserver !== 'undefined') {
      this.ngZone.runOutsideAngular(() => {
        this.heroObserver = new IntersectionObserver((entries) => {
          const entry = entries[0];
          if (entry) {
            this.isHeroVisible = entry.isIntersecting;
            if (!this.isHeroVisible) {
              this.pauseAllVideos();
            } else {
              this.playLayer(this.activeVideoLayer);
              this.scheduleNextTransition();
            }
          }
        }, { threshold: 0 });
        this.heroObserver.observe(this.elRef.nativeElement);
      });
    }
  }

  ngOnDestroy(): void {
    this.clearTimers();
    this.heroObserver?.disconnect();
  }

  private pauseAllVideos(): void {
    this.backgroundVideos?.forEach((videoRef) => {
      try {
        videoRef.nativeElement.pause();
      } catch { }
    });
  }

  protected onVideoLoaded(layerIndex: number): void {
    const video = this.getVideoElement(layerIndex);
    if (!video) {
      return;
    }

    video.currentTime = 0;

    if (layerIndex === this.activeVideoLayer) {
      this.playVideo(video).then(() => {
        this.isInitialVideoReady.set(true);
        this.cdr.markForCheck();
      });
      return;
    }

    if (layerIndex !== this.getHiddenLayerIndex()) {
      return;
    }

    this.playVideo(video).then(() => {
      this.activeVideoLayer = layerIndex;
      this.currentVideoIndex = this.queuedVideoIndex;

      if (this.cleanupTimeoutId) {
        clearTimeout(this.cleanupTimeoutId);
      }

      this.cleanupTimeoutId = setTimeout(() => {
        const previousLayer = this.getHiddenLayerIndex();
        const previousVideo = this.getVideoElement(previousLayer);

        if (previousVideo) {
          previousVideo.pause();
          previousVideo.currentTime = 0;
        }
      }, this.transitionMs);

      this.scheduleNextTransition();
    });
  }

  private scheduleNextTransition(): void {
    if (this.reduceMotion) {
      return;
    }

    if (this.videoSources.length < 2) {
      return;
    }

    if (this.rotationTimeoutId) {
      clearTimeout(this.rotationTimeoutId);
    }

    this.rotationTimeoutId = setTimeout(() => {
      this.prepareNextVideo();
    }, this.videoRotationMs);
  }

  private prepareNextVideo(): void {
    const hiddenLayer = this.getHiddenLayerIndex();
    const nextVideoIndex = (this.currentVideoIndex + 1) % this.videoSources.length;

    this.queuedVideoIndex = nextVideoIndex;
    this.videoLayers[hiddenLayer] = this.videoSources[nextVideoIndex];

    queueMicrotask(() => {
      const hiddenVideo = this.getVideoElement(hiddenLayer);
      if (!hiddenVideo) {
        return;
      }

      hiddenVideo.load();
    });
  }

  private playLayer(layerIndex: number): void {
    const video = this.getVideoElement(layerIndex);
    if (video) {
      video.currentTime = 0;
      void this.playVideo(video);
    }
  }

  private prepareVideoElements(): void {
    this.backgroundVideos?.forEach((videoRef, index) => {
      const video = videoRef.nativeElement;
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', 'true');

      if (index === this.activeVideoLayer) {
        video.load();
        return;
      }

      video.pause();
    });
  }

  private getVideoElement(layerIndex: number): HTMLVideoElement | undefined {
    return this.backgroundVideos?.get(layerIndex)?.nativeElement;
  }

  private getHiddenLayerIndex(): number {
    return this.activeVideoLayer === 0 ? 1 : 0;
  }

  private async playVideo(video: HTMLVideoElement): Promise<void> {
    if (!this.isHeroVisible) return;
    try {
      await video.play();
    } catch {
    }
  }

  private clearTimers(): void {
    if (this.rotationTimeoutId) {
      clearTimeout(this.rotationTimeoutId);
      this.rotationTimeoutId = null;
    }

    if (this.cleanupTimeoutId) {
      clearTimeout(this.cleanupTimeoutId);
      this.cleanupTimeoutId = null;
    }

    if (this.typingTimeoutId) {
      clearTimeout(this.typingTimeoutId);
      this.typingTimeoutId = null;
    }
  }

  private startTypingLoop(): void {
    const topTarget = this.heroTypingLines[0] ?? '';
    const bottomTarget = this.heroTypingLines[1] ?? '';
    const top = this.heroLineTop();
    const bottom = this.heroLineBottom();

    switch (this.typingStage) {
      case 0:
        this.caretLine.set(0);
        if (top.length < topTarget.length) {
          this.heroLineTop.set(topTarget.slice(0, top.length + 1));
          this.queueTypingFrame(85);
          return;
        }

        this.typingStage = 1;
        this.queueTypingFrame(700);
        return;

      case 1:
        this.caretLine.set(1);
        this.typingStage = 2;
        this.queueTypingFrame(80);
        return;

      case 2:
        this.caretLine.set(1);
        if (bottom.length < bottomTarget.length) {
          this.heroLineBottom.set(bottomTarget.slice(0, bottom.length + 1));
          this.queueTypingFrame(85);
          return;
        }

        this.typingStage = 3;
        this.queueTypingFrame(2500);
        return;

      case 3:
        this.caretLine.set(1);
        this.typingStage = 4;
        this.queueTypingFrame(45);
        return;

      case 4:
        this.caretLine.set(1);
        if (bottom.length > 0) {
          this.heroLineBottom.set(bottom.slice(0, -1));
          this.queueTypingFrame(45);
          return;
        }

        this.typingStage = 5;
        this.queueTypingFrame(260);
        return;

      case 5:
        this.caretLine.set(0);
        this.typingStage = 6;
        this.queueTypingFrame(45);
        return;

      case 6:
        this.caretLine.set(0);
        if (top.length > 0) {
          this.heroLineTop.set(top.slice(0, -1));
          this.queueTypingFrame(45);
          return;
        }

        this.typingStage = 7;
        this.queueTypingFrame(350);
        return;

      default:
        this.typingStage = 0;
        this.queueTypingFrame(90);
        return;
    }
  }

  private queueTypingFrame(delayMs: number): void {
    // Already outside Angular zone — setTimeout won't trigger zone-based CD
    this.typingTimeoutId = setTimeout(() => {
      this.startTypingLoop();
    }, delayMs);
  }
}
