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
import { animate, query, stagger, state, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../ui/navbar/navbar.component';
import { AiPromptBarComponent } from '../ai-prompt-bar/ai-prompt-bar.component';
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
    FooterComponent,
    FeaturedItinerariesComponent,
    FeaturesGridComponent,
    CtaSectionComponent,
    AppLoaderComponent
  ],
  templateUrl: './home-section.component.html',
  styleUrl: './home-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('homeReveal', [
      state('hidden', style({ opacity: 0 })),
      state('visible', style({ opacity: 1 })),
      transition('hidden => visible', [
        query('.hero-reveal', [
          style({ opacity: 0, transform: 'translateY(24px)' }),
          stagger(140, animate('700ms cubic-bezier(0.2, 0, 0, 1)', style({ opacity: 1, transform: 'none' })))
        ], { optional: true })
      ])
    ])
  ]
})
export class HomeSectionComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren('backgroundVideo')
  private backgroundVideos!: QueryList<ElementRef<HTMLVideoElement>>;

  protected readonly publicItineraries = signal<Itinerary[]>([]);
  protected readonly isLoadingPublicItineraries = signal(true);
  private readonly itineraryService = inject(ItineraryService);
  protected readonly isHeroContentVisible = signal(false);

  protected readonly heroTopText = signal('');
  protected readonly heroBottomText = signal('');
  protected readonly activeTypingLine = signal<'top' | 'bottom' | 'none'>('none');

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

  private currentVideoIndex = 0;
  private queuedVideoIndex = 1;
  private rotationTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private cleanupTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private heroTypingTimeoutIds: ReturnType<typeof setTimeout>[] = [];

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
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => {
      this.prepareVideoElements();
      this.playLayer(this.activeVideoLayer);
      this.initializeHeroTyping();
      this.isHeroContentVisible.set(true);
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
    this.destroyHeroTyping();
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
  }

  private initializeHeroTyping(): void {
    const topTarget = this.heroTypingLines[0] ?? '';
    const bottomTarget = this.heroTypingLines[1] ?? '';

    this.clearHeroTypingTimers();
    this.heroTopText.set('');
    this.heroBottomText.set('');
    this.activeTypingLine.set('none');

    if (this.reduceMotion) {
      this.heroTopText.set(topTarget);
      this.heroBottomText.set(bottomTarget);
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      const typeSpeed = 50; // Calma ma non troppo lenta
      const untypeSpeed = 45;
      const readDelay = 3000;
      const lineDelay = 300;

      const typeLine = (
        target: string,
        update: (value: string) => void,
        startDelay = 0,
        speed = 100,
        onComplete?: () => void,
      ) => {
        let currentIndex = 0;
        const tick = () => {
          currentIndex += 1;
          update(target.slice(0, currentIndex));
          if (currentIndex < target.length) {
            const nextTimeoutId = setTimeout(tick, speed);
            this.heroTypingTimeoutIds.push(nextTimeoutId);
            return;
          }
          onComplete?.();
        };
        const timeoutId = setTimeout(tick, startDelay);
        this.heroTypingTimeoutIds.push(timeoutId);
      };

      const untypeLine = (
        target: string,
        update: (value: string) => void,
        startDelay = 0,
        speed = 60,
        onComplete?: () => void,
      ) => {
        let currentIndex = target.length;
        const tick = () => {
          currentIndex -= 1;
          update(target.slice(0, currentIndex));
          if (currentIndex > 0) {
            const nextTimeoutId = setTimeout(tick, speed);
            this.heroTypingTimeoutIds.push(nextTimeoutId);
            return;
          }
          onComplete?.();
        };
        const timeoutId = setTimeout(tick, startDelay);
        this.heroTypingTimeoutIds.push(timeoutId);
      };

      const typeLoop = () => {
        this.activeTypingLine.set('top');
        typeLine(topTarget, (value) => this.heroTopText.set(value), 150, typeSpeed, () => {
          const bottomStartTimeoutId = setTimeout(() => {
            this.activeTypingLine.set('bottom');
            typeLine(bottomTarget, (value) => this.heroBottomText.set(value), 0, typeSpeed, () => {
              const readTimeoutId = setTimeout(() => {
                untypeLine(bottomTarget, (value) => this.heroBottomText.set(value), 0, untypeSpeed, () => {
                  this.activeTypingLine.set('none');
                  const topUntypeTimeoutId = setTimeout(() => {
                    this.activeTypingLine.set('top');
                    untypeLine(topTarget, (value) => this.heroTopText.set(value), 0, untypeSpeed, () => {
                      this.activeTypingLine.set('none');
                      const loopTimeoutId = setTimeout(typeLoop, 800);
                      this.heroTypingTimeoutIds.push(loopTimeoutId);
                    });
                  }, 100);
                  this.heroTypingTimeoutIds.push(topUntypeTimeoutId);
                });
              }, readDelay);
              this.heroTypingTimeoutIds.push(readTimeoutId);
            });
          }, lineDelay);
          this.heroTypingTimeoutIds.push(bottomStartTimeoutId);
        });
      };

      typeLoop();
    });
  }

  private destroyHeroTyping(): void {
    this.clearHeroTypingTimers();
    this.heroTopText.set('');
    this.heroBottomText.set('');
  }

  private clearHeroTypingTimers(): void {
    for (const timeoutId of this.heroTypingTimeoutIds) {
      clearTimeout(timeoutId);
    }

    this.heroTypingTimeoutIds = [];
  }
}
